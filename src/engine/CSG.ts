import * as THREE from 'three';

export class CSGVertex {
  public pos: THREE.Vector3;
  public normal: THREE.Vector3;
  public uv: THREE.Vector2;
  public color: THREE.Color;

  constructor(
    pos = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    uv = new THREE.Vector2(),
    color = new THREE.Color(0xffffff)
  ) {
    this.pos = pos;
    this.normal = normal;
    this.uv = uv;
    this.color = color;
  }

  clone() {
    return new CSGVertex(
      this.pos.clone(),
      this.normal.clone(),
      this.uv.clone(),
      this.color.clone()
    );
  }

  flip() {
    this.normal.negate();
  }

  interpolate(other: CSGVertex, t: number) {
    return new CSGVertex(
      new THREE.Vector3().lerpVectors(this.pos, other.pos, t),
      new THREE.Vector3().lerpVectors(this.normal, other.normal, t),
      new THREE.Vector2().lerpVectors(this.uv, other.uv, t),
      new THREE.Color().lerpColors(this.color, other.color, t)
    );
  }
}

export class CSGPlane {
  static EPSILON = 1e-5;
  public normal: THREE.Vector3;
  public w: number;

  constructor(normal = new THREE.Vector3(), w = 0) {
    this.normal = normal;
    this.w = w;
  }

  clone() {
    return new CSGPlane(this.normal.clone(), this.w);
  }

  flip() {
    this.normal.negate();
    this.w = -this.w;
  }

  splitPolygon(
    polygon: CSGPolygon,
    coplanarFront: CSGPolygon[],
    coplanarBack: CSGPolygon[],
    front: CSGPolygon[],
    back: CSGPolygon[]
  ) {
    const COPLANAR = 0;
    const FRONT = 1;
    const BACK = 2;
    const SPANNING = 3;

    const types: number[] = [];
    for (let i = 0; i < polygon.vertices.length; i++) {
      const t = this.normal.dot(polygon.vertices[i].pos) - this.w;
      const type =
        t < -CSGPlane.EPSILON
          ? BACK
          : t > CSGPlane.EPSILON
          ? FRONT
          : COPLANAR;
      types.push(type);
    }

    let polygonType = 0;
    for (let i = 0; i < polygon.vertices.length; i++) {
      polygonType |= types[i];
    }

    if (polygonType === COPLANAR) {
      if (this.normal.dot(polygon.plane.normal) > 0) {
        coplanarFront.push(polygon);
      } else {
        coplanarBack.push(polygon);
      }
    } else if (polygonType === FRONT) {
      front.push(polygon);
    } else if (polygonType === BACK) {
      back.push(polygon);
    } else if (polygonType === SPANNING) {
      const f: CSGVertex[] = [];
      const b: CSGVertex[] = [];
      for (let i = 0; i < polygon.vertices.length; i++) {
        const j = (i + 1) % polygon.vertices.length;
        const ti = types[i];
        const tj = types[j];
        const vi = polygon.vertices[i];
        const vj = polygon.vertices[j];

        if (ti !== BACK) f.push(vi);
        if (ti !== FRONT) b.push(vi);

        if ((ti | tj) === SPANNING) {
          const t =
            (this.w - this.normal.dot(vi.pos)) /
            this.normal.dot(new THREE.Vector3().subVectors(vj.pos, vi.pos));
          const v = vi.interpolate(vj, t);
          f.push(v);
          b.push(v);
        }
      }
      if (f.length >= 3) {
        front.push(new CSGPolygon(f, polygon.shared));
      }
      if (b.length >= 3) {
        back.push(new CSGPolygon(b, polygon.shared));
      }
    }
  }
}

export class CSGPolygon {
  public plane: CSGPlane;
  public vertices: CSGVertex[];
  public shared: any;

  constructor(vertices: CSGVertex[] = [], shared: any = null) {
    this.vertices = vertices;
    this.shared = shared;
    this.plane = new CSGPlane();
    if (vertices.length >= 3) {
      const a = vertices[0].pos;
      const b = vertices[1].pos;
      const c = vertices[2].pos;

      const cb = new THREE.Vector3().subVectors(c, b);
      const ab = new THREE.Vector3().subVectors(a, b);
      const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();

      this.plane.normal.copy(normal);
      this.plane.w = normal.dot(b);
    }
  }

  clone() {
    return new CSGPolygon(
      this.vertices.map((v) => v.clone()),
      this.shared
    );
  }

  flip() {
    this.vertices.reverse().forEach((v) => v.flip());
    this.plane.flip();
  }
}

export class CSGNode {
  public plane: CSGPlane | null = null;
  public front: CSGNode | null = null;
  public back: CSGNode | null = null;
  public polygons: CSGPolygon[] = [];

  constructor(polygons?: CSGPolygon[]) {
    if (polygons) {
      this.build(polygons);
    }
  }

  clone(): CSGNode {
    const node = new CSGNode();
    node.plane = this.plane ? this.plane.clone() : null;
    node.front = this.front ? this.front.clone() : null;
    node.back = this.back ? this.back.clone() : null;
    node.polygons = this.polygons.map((p) => p.clone());
    return node;
  }

  allPolygons(): CSGPolygon[] {
    let list = [...this.polygons];
    if (this.front) list = list.concat(this.front.allPolygons());
    if (this.back) list = list.concat(this.back.allPolygons());
    return list;
  }

  invert() {
    for (let i = 0; i < this.polygons.length; i++) {
      this.polygons[i].flip();
    }
    if (this.plane) this.plane.flip();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();

    const temp = this.front;
    this.front = this.back;
    this.back = temp;
  }

  clipPolygons(list: CSGPolygon[]): CSGPolygon[] {
    if (!this.plane) return [...list];

    let frontList: CSGPolygon[] = [];
    let backList: CSGPolygon[] = [];

    for (let i = 0; i < list.length; i++) {
      this.plane.splitPolygon(list[i], frontList, backList, frontList, backList);
    }

    if (this.front) frontList = this.front.clipPolygons(frontList);
    if (this.back) {
      backList = this.back.clipPolygons(backList);
    } else {
      backList = [];
    }

    return frontList.concat(backList);
  }

  clipTo(bsp: CSGNode) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }

  build(polygons: CSGPolygon[]) {
    if (polygons.length === 0) return;

    if (!this.plane) {
      this.plane = polygons[0].plane.clone();
    }

    const frontList: CSGPolygon[] = [];
    const backList: CSGPolygon[] = [];

    for (let i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(
        polygons[i],
        this.polygons,
        this.polygons,
        frontList,
        backList
      );
    }

    if (frontList.length > 0) {
      if (!this.front) this.front = new CSGNode();
      this.front.build(frontList);
    }
    if (backList.length > 0) {
      if (!this.back) this.back = new CSGNode();
      this.back.build(backList);
    }
  }
}

// Boolean operations
export function union(a1: CSGNode, b1: CSGNode): CSGNode {
  const a = a1.clone();
  const b = b1.clone();
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  return a;
}

export function subtract(a1: CSGNode, b1: CSGNode): CSGNode {
  const a = a1.clone();
  const b = b1.clone();
  a.invert();
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  a.invert();
  return a;
}

export function intersect(a1: CSGNode, b1: CSGNode): CSGNode {
  const a = a1.clone();
  const b = b1.clone();
  a.invert();
  b.clipTo(a);
  b.invert();
  a.clipTo(b);
  b.clipTo(a);
  a.build(b.allPolygons());
  a.invert();
  return a;
}

// Convert BufferGeometry to CSGNode
export function fromGeometry(geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): CSGNode {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return new CSGNode([]);

  const normAttr = geometry.getAttribute('normal');
  const uvAttr = geometry.getAttribute('uv');

  let indices: ArrayLike<number> | null = null;
  if (geometry.index) {
    indices = geometry.index.array;
  }

  const polygons: CSGPolygon[] = [];
  const vertexCount = indices ? indices.length : posAttr.count;

  for (let i = 0; i < vertexCount; i += 3) {
    const vertices: CSGVertex[] = [];
    let valid = true;

    for (let j = 0; j < 3; j++) {
      const idx = indices ? indices[i + j] : i + j;

      const pos = new THREE.Vector3(
        posAttr.getX(idx),
        posAttr.getY(idx),
        posAttr.getZ(idx)
      );
      if (matrix) {
        pos.applyMatrix4(matrix);
      }

      const normal = new THREE.Vector3();
      if (normAttr) {
        normal.set(normAttr.getX(idx), normAttr.getY(idx), normAttr.getZ(idx));
        if (matrix) {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
          normal.applyMatrix3(normalMatrix).normalize();
        }
      }

      const uv = new THREE.Vector2();
      if (uvAttr) {
        uv.set(uvAttr.getX(idx), uvAttr.getY(idx));
      }

      vertices.push(new CSGVertex(pos, normal, uv));
    }

    if (!normAttr) {
      const cb = new THREE.Vector3().subVectors(vertices[2].pos, vertices[1].pos);
      const ab = new THREE.Vector3().subVectors(vertices[0].pos, vertices[1].pos);
      const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();
      if (normal.lengthSq() < 1e-8) {
        valid = false;
      } else {
        vertices.forEach((v) => v.normal.copy(normal));
      }
    }

    if (valid) {
      polygons.push(new CSGPolygon(vertices));
    }
  }

  return new CSGNode(polygons);
}

// Convert CSGNode to BufferGeometry
export function toGeometry(node: CSGNode): THREE.BufferGeometry {
  const polygons = node.allPolygons();

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i < polygons.length; i++) {
    const poly = polygons[i];
    for (let j = 1; j < poly.vertices.length - 1; j++) {
      const v0 = poly.vertices[0];
      const v1 = poly.vertices[j];
      const v2 = poly.vertices[j + 1];

      positions.push(v0.pos.x, v0.pos.y, v0.pos.z);
      positions.push(v1.pos.x, v1.pos.y, v1.pos.z);
      positions.push(v2.pos.x, v2.pos.y, v2.pos.z);

      normals.push(v0.normal.x, v0.normal.y, v0.normal.z);
      normals.push(v1.normal.x, v1.normal.y, v1.normal.z);
      normals.push(v2.normal.x, v2.normal.y, v2.normal.z);

      uvs.push(v0.uv.x, v0.uv.y);
      uvs.push(v1.uv.x, v1.uv.y);
      uvs.push(v2.uv.x, v2.uv.y);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geom;
}
