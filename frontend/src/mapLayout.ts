export type MapPoint = [x: number, y: number]

export const mapGeometry = {
  width: 680,
  minHeight: 340,
  nodeWidth: 196,
  nodeHeight: 58,
  hubSize: 132,
  rowSpacing: 86,
}

const orbits: MapPoint[][] = [
  [],
  [[50, 82]],
  [[18, 50], [82, 50]],
  [[50, 15], [82, 72], [18, 72]],
  [[19, 23], [81, 23], [81, 77], [19, 77]],
  [[50, 15], [82, 34], [77, 82], [23, 82], [18, 34]],
  [[50, 13], [82, 27], [82, 72], [50, 87], [18, 72], [18, 27]],
  [[50, 13], [82, 26], [82, 61], [68, 86], [32, 86], [18, 61], [18, 26]],
]

export function getMapLayout(count: number): { width: number; height: number; points: MapPoint[] } {
  const { width, minHeight, nodeHeight, rowSpacing } = mapGeometry
  const orbit = orbits[count]
  if (orbit) return { width, height: minHeight, points: orbit }

  // Continue clockwise down the right side and up the left. Extra rows add
  // height so the gap between cards remains consistent.
  const rightCount = Math.ceil(count / 2)
  const leftCount = count - rightCount
  const height = Math.max(minHeight, (rightCount - 1) * rowSpacing + nodeHeight + 48)
  const y = (index: number, length: number) => 50 + ((index - (length - 1) / 2) * rowSpacing / height) * 100
  const right = Array.from({ length: rightCount }, (_, index): MapPoint => [81, y(index, rightCount)])
  const left = Array.from({ length: leftCount }, (_, index): MapPoint => [19, y(leftCount - index - 1, leftCount)])
  return { width, height, points: [...right, ...left] }
}
