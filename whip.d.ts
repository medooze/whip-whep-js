export declare class WHIPClient {
    constructor();
    publish(pc: RTCPeerConnection, url: string, token?: string): Promise<void>;
    restart(): void;
    patch(): Promise<void>;
    mute(muted: any): Promise<void>;
    stop(): Promise<void>;
    onOffer(sdp: RTCSessionDescriptionInit): RTCSessionDescriptionInit;
    onAnswer(sdp: RTCSessionDescriptionInit): RTCSessionDescriptionInit;
}