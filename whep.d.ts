export declare class WHEPClient extends EventTarget {
    constructor();
    view(pc: RTCPeerConnection, url: string, token?: string): Promise<void>;
    restart(): void;
    patch(): Promise<void>;
    mute(muted: any): Promise<void>;
    stop(): Promise<void>;
    selectLayer(): Promise<void>;
    unselectLayer(): Promise<void>;
    onOffer(sdp: RTCSessionDescriptionInit): RTCSessionDescriptionInit;
    onAnswer(sdp: RTCSessionDescriptionInit): RTCSessionDescriptionInit;
}