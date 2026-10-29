export type Action = {
    id: string;
    text: string;
    kind: 'next' | 'nav' | 'read' | 'email' | 'message' | 'copy' | 'back' | 'narrow';
    target?: string;
};
export type Reply = {
    text: string;
    intent?: string;
    target?: string;
};
