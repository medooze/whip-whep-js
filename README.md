# whip-js
Simple WHIP client javascript module

## Example

```
import { WHIPClient } from "whip.js"

//Get mic+cam
const stream = await navigator.mediaDevices.getUserMedia({audio:true, video:true});

//Create peerconnection
const pc = new RTCPeerConnection();

//Send all tracks
for (const track of stream.getTracks()) {
	//You could add simulcast too here
	pc.addTrack(track);
}

//Create whip client
const whip = new WHIPClient();

const url = "https://whip.test/whip/endpoint";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IndoaXAgdGVzdCIsImlhdCI6MTUxNjIzOTAyMn0.jpM01xu_vnSXioxQ3I7Z45bRh5eWRBEY2WJPZ6FerR8";

//Start publishing
whip.publish(pc, url, token);

```