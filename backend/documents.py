"""Lecture import, page preview and lexical retrieval for PDF and PPTX."""
import base64
import hashlib
import io
import os
import re
import sqlite3
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from html import escape
from pathlib import Path
from zipfile import ZipFile

import pymupdf
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/documents", tags=["Documents"])
LIMIT = 40 * 1024 * 1024
MIME = {"pdf": "application/pdf", "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}


@contextmanager
def database():
    path = os.getenv("STUDYGRAPH_DATABASE", str(Path(__file__).with_name("lectures.sqlite3")))
    db = sqlite3.connect(path, timeout=30)
    db.row_factory = sqlite3.Row
    try:
        with db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS docs(id TEXT PRIMARY KEY, name TEXT, kind TEXT, total INTEGER, original BLOB);
                CREATE TABLE IF NOT EXISTS pages(doc TEXT, num INTEGER, text TEXT, html TEXT, PRIMARY KEY(doc,num));
                CREATE TABLE IF NOT EXISTS renderings(doc TEXT PRIMARY KEY, pdf BLOB);
                CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(terms, doc UNINDEXED, page UNINDEXED, id UNINDEXED, body UNINDEXED);
            """)
            yield db
    finally:
        db.close()


def tokens(text):
    words = []
    for word in re.findall(r"[a-z0-9]+|[\u3400-\u9fff]+", text.lower()):
        if ord(word[0]) >= 0x3400 and len(word) > 1:
            words.extend(word[i:i+2] for i in range(len(word)-1))
        else:
            words.append(word)
    return words


def slide_content(shapes):
    for shape in shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from slide_content(shape.shapes)
        elif shape.has_table:
            for row in shape.table.rows:
                line = " | ".join(cell.text for cell in row.cells)
                yield line, "<p>" + escape(line) + "</p>"
        elif shape.has_text_frame:
            yield shape.text, "<p>" + escape(shape.text) + "</p>"
        elif shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
            image = shape.image
            if image.content_type in {"image/png", "image/jpeg", "image/gif"}:
                encoded = base64.b64encode(image.blob).decode("ascii")
                yield "", f'<img src="data:{image.content_type};base64,{encoded}" alt="">'


def parse(data, kind):
    if kind == "pdf":
        with pymupdf.open(stream=data, filetype="pdf") as pdf:
            if pdf.needs_pass:
                raise ValueError("请先解除 PDF 密码保护")
            for page in pdf:
                text = page.get_text(sort=True)
                languages = os.getenv("STUDYGRAPH_OCR_LANG")
                if not text.strip() and languages:
                    textpage = page.get_textpage_ocr(language=languages, dpi=200, full=True)
                    text = page.get_text(textpage=textpage, sort=True)
                yield text, ""
    else:
        with ZipFile(io.BytesIO(data)) as archive:
            if sum(entry.file_size for entry in archive.infolist()) > 200 * 1024**2:
                raise ValueError("课件解压后超过 200 MiB")
        for slide in Presentation(io.BytesIO(data)).slides:
            parts = list(slide_content(slide.shapes))
            html = '<meta charset="utf-8"><style>body{font:18px/1.5 system-ui}p{white-space:pre-wrap}img{max-width:95%}</style>'
            yield "\n".join(text for text, _ in parts), html + "".join(markup for _, markup in parts)


def render_slides(data):
    office = os.getenv("SOFFICE_PATH") or shutil.which("soffice")
    if not office:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        source = folder / "slides.pptx"
        source.write_bytes(data)
        subprocess.run([office, "-env:UserInstallation=" + (folder / "profile").as_uri(),
                        "--headless", "--convert-to", "pdf", "--outdir", tmp, str(source)],
                       check=True, capture_output=True, timeout=90)
        return source.with_suffix(".pdf").read_bytes()


class DocumentInfo(BaseModel):
    document_id: str
    name: str
    kind: str
    page_count: int
    original_url: str
    preview_mode: str
    pages_without_text: list[int]


class Chunk(BaseModel):
    chunk_id: str
    text: str


class PageInfo(BaseModel):
    document_id: str
    page: int
    text: str
    chunks: list[Chunk]
    preview_url: str


class Hit(Chunk):
    document_id: str
    page: int
    preview_url: str


def metadata(db, doc):
    row = db.execute("SELECT id AS document_id,name,kind,total AS page_count FROM docs WHERE id=?", (doc,)).fetchone()
    if not row:
        raise HTTPException(404, "讲义不存在")
    empty = db.execute("SELECT num FROM pages WHERE doc=? AND text='' ORDER BY num", (doc,))
    return {**dict(row), "original_url": f"/api/documents/{doc}/original",
            "preview_mode": "page_image" if row["kind"] == "pdf" or db.execute(
                "SELECT 1 FROM renderings WHERE doc=?", (doc,)).fetchone() else "slide_content",
            "pages_without_text": [r[0] for r in empty]}


@router.post("", status_code=201, response_model=DocumentInfo)
def upload(file: UploadFile = File(...)):
    name = Path(file.filename or "").name
    kind = Path(name).suffix.lower().lstrip(".")
    if kind not in MIME:
        raise HTTPException(415, "支持 PDF 和 PPTX；旧版 PPT 请另存为 PPTX")
    data = file.file.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise HTTPException(413, "文件超过 40 MiB")
    doc = hashlib.sha256(data).hexdigest()
    with database() as db:
        if db.execute("SELECT 1 FROM docs WHERE id=?", (doc,)).fetchone():
            return metadata(db, doc)
        try:
            pages = list(parse(data, kind))
            rendered = render_slides(data) if kind == "pptx" else None
            if rendered:
                converted = list(parse(rendered, "pdf"))
                if len(converted) == len(pages):
                    pages = [(original or extracted, "") for (original, _), (extracted, _) in zip(pages, converted)]
                else:
                    rendered = None
        except (subprocess.SubprocessError, OSError) as exc:
            raise HTTPException(422, "文件读取或课件转换失败，请检查文件和 LibreOffice 配置") from exc
        except Exception as exc:
            raise HTTPException(422, "无法解析文件，请检查格式、密码或文件完整性") from exc
        if not pages:
            raise HTTPException(422, "讲义没有页面")
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM docs WHERE id=?", (doc,)).fetchone():
            return metadata(db, doc)
        db.execute("INSERT INTO docs VALUES(?,?,?,?,?)", (doc, name, kind, len(pages), data))
        if rendered:
            db.execute("INSERT INTO renderings VALUES(?,?)", (doc, rendered))
        for num, (text, html) in enumerate(pages, 1):
            text = text.strip()
            db.execute("INSERT INTO pages VALUES(?,?,?,?)", (doc, num, text, html))
            for start in range(0, len(text), 800):
                body = text[start:start+900]
                ident = f"{doc}-p{num}-{start//800+1}"
                db.execute("INSERT INTO chunks VALUES(?,?,?,?,?)", (" ".join(tokens(body)), doc, num, ident, body))
        return metadata(db, doc)


@router.get("", response_model=list[DocumentInfo])
def documents():
    with database() as db:
        return [metadata(db, r[0]) for r in db.execute("SELECT id FROM docs ORDER BY rowid DESC")]


@router.get("/{doc}", response_model=DocumentInfo)
def document(doc: str):
    with database() as db:
        return metadata(db, doc)


@router.get("/{doc}/original")
def original(doc: str):
    with database() as db:
        info = metadata(db, doc)
        data = db.execute("SELECT original FROM docs WHERE id=?", (doc,)).fetchone()[0]
        return Response(data, media_type=MIME[info["kind"]])


def page_row(db, doc, num):
    row = db.execute("SELECT text,html FROM pages WHERE doc=? AND num=?", (doc,num)).fetchone()
    if not row:
        raise HTTPException(404, "讲义或页码不存在")
    return row


@router.get("/{doc}/pages/{num}", response_model=PageInfo)
def page(doc: str, num: int):
    with database() as db:
        row = page_row(db, doc, num)
        chunks = db.execute("SELECT id AS chunk_id,body AS text FROM chunks WHERE doc=? AND page=? ORDER BY rowid", (doc,num))
        return {"document_id": doc, "page": num, "text": row["text"], "chunks": [dict(r) for r in chunks],
                "preview_url": f"/api/documents/{doc}/pages/{num}/preview"}


@router.get("/{doc}/pages/{num}/preview")
def preview(doc: str, num: int):
    with database() as db:
        row = page_row(db, doc, num)
        if row["html"]:
            return Response(row["html"], media_type="text/html", headers={"Content-Security-Policy":"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"})
        data = db.execute("SELECT COALESCE((SELECT pdf FROM renderings WHERE doc=?),original) FROM docs WHERE id=?", (doc,doc)).fetchone()[0]
    with pymupdf.open(stream=data, filetype="pdf") as pdf:
        source = pdf[num-1]
        scale = min(1.6, 1500/max(source.rect.width, source.rect.height, 1))
        png = source.get_pixmap(matrix=pymupdf.Matrix(scale,scale)).tobytes("png")
    return Response(png, media_type="image/png")


class Search(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=4, ge=1, le=10)


@router.post("/{doc}/search", response_model=list[Hit])
def search(doc: str, body: Search):
    with database() as db:
        metadata(db, doc)
        terms = list(dict.fromkeys(tokens(body.query)))[:80]
        if not terms:
            return []
        match = " OR ".join(f'"{t}"' for t in terms)
        rows = db.execute("""SELECT doc AS document_id,id AS chunk_id,page,body AS text
                             FROM chunks WHERE chunks MATCH ? AND doc=? ORDER BY rank LIMIT ?""",
                          (match, doc, body.top_k))
        return [{**dict(r), "preview_url": f"/api/documents/{doc}/pages/{r['page']}/preview"} for r in rows]
