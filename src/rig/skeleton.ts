export type Transform = {
    rot?: number;
    sx?: number;
    sy?: number;
    tx?: number;
    ty?: number;
};
export type Pose = Record<string, Transform>;
export type Bone = {
    id: string;
    parent: string | null;
    x: number;
    y: number;
};
export const skeleton: Bone[] = [{ id: 'root', parent: null, x: 0, y: 0 }, { id: 'hips', parent: 'root', x: 0, y: 0 }, { id: 'spine1', parent: 'hips', x: 0, y: -28 }, { id: 'spine2', parent: 'spine1', x: 5, y: -35 }, { id: 'neck', parent: 'spine2', x: -2, y: -20 }, { id: 'head', parent: 'neck', x: 0, y: -23 }, { id: 'earL', parent: 'head', x: -15, y: -22 }, { id: 'fold', parent: 'earL', x: -5, y: -23 }, { id: 'earR', parent: 'head', x: 15, y: -23 }, { id: 'glasses', parent: 'head', x: 0, y: -3 }, { id: 'tuft1', parent: 'head', x: 0, y: -29 }, { id: 'tuft2', parent: 'tuft1', x: 0, y: -12 }, { id: 'tuft3', parent: 'tuft2', x: 0, y: -12 }, { id: 'browL', parent: 'head', x: -11, y: -18 }, { id: 'browR', parent: 'head', x: 11, y: -18 }, { id: 'eyes', parent: 'head', x: 0, y: -4 }, { id: 'eyelids', parent: 'head', x: 0, y: -4 }, { id: 'mouth', parent: 'head', x: 0, y: 14 }, { id: 'shoulders', parent: 'spine2', x: 0, y: -4 }, { id: 'upperArm.L', parent: 'shoulders', x: -12, y: 0 }, { id: 'foreArm.L', parent: 'upperArm.L', x: -8, y: 28 }, { id: 'hand.L', parent: 'foreArm.L', x: -4, y: 25 }, { id: 'upperArm.R', parent: 'shoulders', x: 12, y: 0 }, { id: 'foreArm.R', parent: 'upperArm.R', x: 8, y: 28 }, { id: 'hand.R', parent: 'foreArm.R', x: 4, y: 25 }, { id: 'thigh.L', parent: 'hips', x: -9, y: 0 }, { id: 'shin.L', parent: 'thigh.L', x: -5, y: 30 }, { id: 'foot.L', parent: 'shin.L', x: 0, y: 28 }, { id: 'thigh.R', parent: 'hips', x: 9, y: 0 }, { id: 'shin.R', parent: 'thigh.R', x: 5, y: 30 }, { id: 'foot.R', parent: 'shin.R', x: 0, y: 28 }];
export const idlePose: Pose = { 'spine1': { rot: -5 }, 'spine2': { rot: 7 }, 'earL': { rot: -18 }, fold: { rot: 105 }, 'earR': { rot: 14 }, 'upperArm.L': { rot: 5 }, 'upperArm.R': { rot: -5 } };
