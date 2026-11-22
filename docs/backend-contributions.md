# Backend engineering contribution

**Yueqi Liu (Streamerc), backend engineering, retrieval and model integration**

I implemented the lecture ingestion and retrieval APIs. The backend extracts page-level text from PDF and PPTX files, stores documents and search indexes in SQLite, and returns the physical page and a preview URL with each evidence item. I also fixed PDF symbol extraction and connected LaTeX rendering for formulas in study notes. [Lecture APIs](../backend/documents.py) · [Formula fix](https://github.com/lunarharbor50301/Study_Graph/commit/b27b347a657d88e949660e12805d6770efbadc7f)

I connected the pi Agent to TACC-hosted Qwen and added document search, page reading, streamed responses and citation validation. I implemented SQLite-backed conversation history and context summaries, added generation-provider configuration for DeepSeek and TACC, and kept the Tutor on its independently configured provider. I also fixed Test conversations so navigating away or changing questions that reference different lectures keeps the current thread. [Tutor backend](../backend/agent_api.py) · [Provider configuration](../backend/llm_provider.py) · [Conversation fix](https://github.com/lunarharbor50301/Study_Graph/commit/382586b)

I built the initial V3 staged concept-map path with an outline, batched note generation, gap handling and a fallback. The team subsequently integrated continuous multi-page evidence and English reference sets. I also implemented the source-backed practice-question API and integrated sequential Test generation with retry from the failed question. [V3 integration notes](lyq-v3.md) · [Test flow](test-flow.md) · [Retry fix](https://github.com/lunarharbor50301/Study_Graph/commit/7ce5030f4513e51bbf21a676ad209944f44067b5)

I ran TACC integration checks, compared DeepSeek and Qwen generation latency on a small control example, and added a Windows launcher and regression coverage for retrieval, Tutor state and model calls. The [repository README](../README.md) lists the shared evaluation results and the commands to reproduce them.

## Short version for the group submission

Yueqi Liu (Streamerc) developed the backend for lecture ingestion, page-grounded retrieval and model integration. He connected the streaming pi Tutor to TACC Qwen, implemented conversation persistence and the initial staged concept-map pipeline, and integrated DeepSeek generation for study materials and tests. He also fixed Test conversation continuity and per-question retries, added a Windows launcher, and validated the backend through integration checks and regression tests.
