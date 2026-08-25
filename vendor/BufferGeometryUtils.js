// Minimal shim of three.js's examples/jsm/utils/BufferGeometryUtils.js —
// only the one export GLTFLoader.js actually needs (toTrianglesDrawMode),
// so no extra file has to be downloaded separately. Converts a
// TRIANGLE_STRIP/TRIANGLE_FAN geometry to plain TRIANGLES. Not used for
// glTF files exported in the default TRIANGLES mode (e.g. a Blender export),
// but GLTFLoader.js imports it unconditionally, so it must exist.
import { TrianglesDrawMode, TriangleFanDrawMode, TriangleStripDrawMode } from 'three';

function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === TrianglesDrawMode) {
    console.warn('THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.');
    return geometry;
  }

  if (drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode) {
    let index = geometry.getIndex();

    if (index === null) {
      const indices = [];
      const position = geometry.getAttribute('position');
      if (position !== undefined) {
        for (let i = 0; i < position.count; i++) indices.push(i);
        geometry.setIndex(indices);
        index = geometry.getIndex();
      } else {
        console.error('THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.');
        return geometry;
      }
    }

    const numberOfTriangles = index.count - 2;
    const newIndices = [];

    if (drawMode === TriangleFanDrawMode) {
      for (let i = 1; i <= numberOfTriangles; i++) {
        newIndices.push(index.getX(0));
        newIndices.push(index.getX(i));
        newIndices.push(index.getX(i + 1));
      }
    } else {
      for (let i = 0; i < numberOfTriangles; i++) {
        if (i % 2 === 0) {
          newIndices.push(index.getX(i));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i + 2));
        } else {
          newIndices.push(index.getX(i + 2));
          newIndices.push(index.getX(i + 1));
          newIndices.push(index.getX(i));
        }
      }
    }

    const newGeometry = geometry.clone();
    newGeometry.setIndex(newIndices);
    newGeometry.clearGroups();
    return newGeometry;
  }

  console.error('THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode);
  return geometry;
}

export { toTrianglesDrawMode };
