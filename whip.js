//import { EventEmitter } from "events";

export class WHIPClient
{
	constructor()
	{
		//Ice properties
		this.iceUsername = null;
		this.icePassword = null;
		//Pending candidadtes
		this.candidates = [];
		this.endOfcandidates = false;
	}

	async publish(pc, url, token)
	{
		//If already publishing
		if (this.pc)
			throw new Error("Already publishing")

		//Store pc objcet
		this.pc = pc;
		
		//Listen for state change events
		pc.onconnectionstatechange = (event) =>{
			switch(pc.connectionState) {
				case "connected":
					// The connection has become fully connected
					break;
				case "disconnected":
				case "failed":
					// One or more transports has terminated unexpectedly or in an error
					break;
				case "closed":
					// The connection has been closed
					break;
			}
		}

		//Listen for candidates
		pc.onicecandidate = (event)=>{

			if (event.candidate) 
				//Store candidate
				this.candidates.push(event.candidate);                                         
			else
				//No more candidates
				this.endOfcandidates = true;
			//Schedule trickle on next tick
			if (!this.iceTrickeTimeout)
				this.iceTrickeTimeout = setTimeout(()=>this.trickle(),0);
		}
		//Create SDP offer
		const offer = await pc.createOffer();

		//Set it and keep the promise
		const sld =  pc.setLocalDescription(offer);

		//The token can be optionally provided, set it if it was.
		var headers = {
			"Content-Type": "application/sdp"
		};
		if (token)
			headers["Authorization"] = "Bearer " + token

		//Do the post request to the WHIP endpoint with the SDP offer
		const fetched = await fetch(url, {
			method: "POST",
			body: offer.sdp,
			headers: headers
		});

		//Get the resource url
		this.resourceURL = new URL(fetched.headers.get("location"), url);

		//Get the SDP answer
		const answer = await fetched.text();

		//Wait until the offer was set locally
		await sld;

		
		try {
			//Get local ice properties
			const local = this.pc.getTransceivers()[0].sender.transport.iceTransport.getLocalParameters();
			//Get them for transport
			this.iceUsername = local.usernameFragment;
			this.icePassword = local.password;
		} catch (e) {
			//Fallback for browsers not supporting ice transport
			this.iceUsername = offer.sdp.match(/a=ice-ufrag:(.*)\r\n/)[1];
			this.icePassword = offer.sdp.match(/a=ice-pwd:(.*)\r\n/)[1];
		}

		//Schedule trickle on next tick
		if (!this.iceTrickeTimeout)
			this.iceTrickeTimeout = setTimeout(()=>this.trickle(),0);

		//And set remote description
		await pc.setRemoteDescription({type:"answer",sdp: answer});
	}

	async trickle()
	{
		//Clear timeout
		this.iceTrickeTimeout = null;

		//Check if there is any pending data
		if (!this.candidates.length || !this.endOfcandidates || !this.resourceURL)
			//Do nothing
			return;
		//Prepare fragment
		let fragment = 
			"a=ice-ufrag:" + this.iceUsername + "\r\n" +
			"a=ice-pwd:" + this.icePassword + "\r\n";
		//Get peerconnection transceivers
		const transceivers = this.pc.getTransceivers();
		//Get medias
		const medias = {};
		//For each candidate
		for (const candidate of this.candidates)
		{
			//Get mid for candidate
			const mid = candidate.sdpMid
			//Get associated transceiver
			const transceiver = transceivers.find(t=>t.mid==mid);
			//Get media
			let media = medias[mid];
			//If not found yet
			if (!media)
				//Create media object
				media = medias[mid] = {
					mid,
					kind : transceiver.receiver.track.kind,
					candidates: [],
				};
			//Add candidate
			media.candidates.push(candidate);
		}
		//For each media
		for (const media of Object.values(medias))
		{
			//Add media to fragment
			fragment += 
				"m="+ media.kind + " RTP/AVP 0\r\n" +
				"a=mid:"+ media.mid + "\r\n";
			//Add candidate
			for (const candidate of media.candidates)
				fragment += "a=" + candidate.candidate + "\r\n";
			if (this.endOfcandidates)
				fragment += "a=end-of-candiadates\r\n";
		}
		//Clean pending data
		this.candidates = [];
		this.endOfcandidates = false;

		//Do the post request to the WHIP resource
		await fetch(this.resourceURL, {
			method: "PATCH",
			body: fragment,
			headers:{
				"Content-Type": "application/trickle-ice-sdpfrag"
			}
		});
	}

	async stop()
	{
		//Cancel any pending timeout
		this.iceTrickeTimeout = clearTimeout(this.iceTrickeTimeout);

		//If we don't have the resource url
		if (!this.resourceURL)
			throw new Error("WHIP resource url not available yet");

		//Send a delete
		await fetch(this.resourceURL, {
			method: "DELETE",
		});

		//Close peerconnection
		this.pc.close();

		//Null
		this.pc = null;
	}
};
