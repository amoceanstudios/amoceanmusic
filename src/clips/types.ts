import type { Pose } from '../rig/skeleton';
export type Key = {
    t: number;
    pose: Pose;
    ease?: 'hold' | 'linear' | 'elastic' | 'smooth';
};
export type Clip = {
    keys: Key[];
    anchors: [
        number,
        number
    ][];
};
