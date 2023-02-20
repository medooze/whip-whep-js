# whip.js
WHIP client javascript module

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

# whep.js
WHEP client javascript module

## Example

```
import { WHEPClient } from "whep.js"

//Create peerconnection
const pc = window.pc = new RTCPeerConnection();

//Add recv only transceivers
pc.addTransceiver("audio");
pc.addTransceiver("video");

pc.ontrack = (event) =>
{
	console.log(event)
	if (event.track.kind == "video")
		document.querySelector("video").srcObject = event.streams[0];
}

//Create whep client
const whep = new WHEPClient();

const url = "https://whep.test/whep/endpoint";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtaWxsaWNhc3QiOnsidHlwZSI6IlN1YnNjcmliZSIsInNlcnZlcklkIjoidmlld2VyMSIsInN0cmVhbUFjY291bnRJZCI6InRlc3QiLCJzdHJlYW1OYW1lIjoidGVzdCJ9LCJpYXQiOjE2NzY2NDkxOTd9.ZE8Ftz9qiS04zTKBqP1MHZTOh8dvI73FBraleQM9h1A"

//Start viewing
whep.view(pc, url, token);

```
