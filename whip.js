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

	async publish(url, token, pc)
	{
		//If already publishing
		if (this.pc)
			throw new Error("Already publishing")

		//Store pc objcet and token
		this.token = token;
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
			{
				//Ignore candidates not from the first m line
				if (event.candidate.sdpMLineIndex>0)
					//Skip
					return;
				//Store candidate
				this.candidates.push(event.candidate);                                         
			} else {
				//No more candidates
				this.endOfcandidates = true;
			}
			//Schedule trickle on next tick
			if (!this.iceTrickeTimeout)
				this.iceTrickeTimeout = setTimeout(()=>this.trickle(),0);
		}
		//Create SDP offer
		const offer = await pc.createOffer();

		//Set it and keep the promise
		const sld =  pc.setLocalDescription(offer);

		//Request headers
		const headers = {
			"Content-Type": "application/sdp"
		};

		//If token is set
		if (token)
			headers["Authorization"] = "Bearer " + token;

		//Do the post request to the WHIP endpoint with the SDP offer
		const fetched = await fetch(url, {
			method: "POST",
			body: offer.sdp,
			headers
		});

		//Get the resource url
		this.resourceURL = new URL(fetched.headers.get("location"), url);

		//Get the SDP answer
		const answer = await fetched.text();

		//Wait until the offer was set locally
		await sld;

		// TODO: chrome is returning a wrong value, so don't use it for now
		//try {
		//	//Get local ice properties
		//	const local = this.pc.getTransceivers()[0].sender.transport.iceTransport.getLocalParameters();
		//	//Get them for transport
		//	this.iceUsername = local.usernameFragment;
		//	this.icePassword = local.password;
		//} catch (e) {
			//Fallback for browsers not supporting ice transport
			this.iceUsername = offer.sdp.match(/a=ice-ufrag:(.*)\r\n/)[1];
			this.icePassword = offer.sdp.match(/a=ice-pwd:(.*)\r\n/)[1];
		//}

		//Schedule trickle on next tick
		if (!this.iceTrickeTimeout)
			this.iceTrickeTimeout = setTimeout(()=>this.trickle(),0);

		//And set remote description
		await pc.setRemoteDescription({type:"answer",sdp: answer});
	}

	restart()
	{
		//Set restart flag
		this.restartIce = true;

		//Schedule trickle on next tick
		if (!this.iceTrickeTimeout)
			this.iceTrickeTimeout = setTimeout(()=>this.trickle(),0);
	}

	async trickle()
	{
		let sld;

		//Clear timeout
		this.iceTrickeTimeout = null;

		//Check if there is any pending data
		if (!(this.candidates.length || this.endOfcandidates || this.restartIce) || !this.resourceURL )
			//Do nothing
			return;

		//Get data
		const candidates = this.candidates;
		let endOfcandidates = this.endOfcandidates;
		const restartIce = this.restartIce;

		//Clean pending data before async operation
		this.candidates = [];
		this.endOfcandidates = false;
		this.restartIce = false;

		//If we need to restart
		if (restartIce)
		{
			//Create a new offer
			const offer = await this.pc.createOffer({iceRestart: true});
			//Update ice
			this.iceUsername = offer.sdp.match(/a=ice-ufrag:(.*)\r\n/)[1];
			this.icePassword = offer.sdp.match(/a=ice-pwd:(.*)\r\n/)[1];
			//Set it and keep the promise
			sld =  pc.setLocalDescription(offer);
			//Clean end of candidates flag as new ones will be retrieved
			endOfcandidates = false;
		}
		//Prepare fragment
		let fragment = 
			"a=ice-ufrag:" + this.iceUsername + "\r\n" +
			"a=ice-pwd:" + this.icePassword + "\r\n";
		//Get peerconnection transceivers
		const transceivers = this.pc.getTransceivers();
		//Get medias
		const medias = {};
		//If doing something else than a restart
		if (candidates.length || endOfcandidates)
			//Create media object for first media always
			medias[transceivers[0].mid] = {
				mid: transceivers[0].mid,
				kind: transceivers[0].receiver.track.kind,
				candidates: [],
			};
		//For each candidate
		for (const candidate of candidates)
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
			if (endOfcandidates)
				fragment += "a=end-of-candiadates\r\n";
		}

		//Request headers
		const headers = {
			"Content-Type": "application/trickle-ice-sdpfrag"
		};

		//If token is set
		if (this.token)
			headers["Authorization"] = "Bearer " + this.token;

		//Do the post request to the WHIP resource
		const fetched = await fetch(this.resourceURL, {
			method: "PATCH",
			body: fragment,
			headers
		});

		//If we have got an answer
		if (fetched.status==200)
		{

			//Get the SDP answer
			const answer = await fetched.text();

			//Get remote icename and password
			const iceUsername = answer.match(/a=ice-ufrag:(.*)\r\n/)[1];
			const icePassword = answer.match(/a=ice-pwd:(.*)\r\n/)[1];

			//Get current remote rescription
			const remoteDescription = this.pc.remoteDescription;

			//Patch
			remoteDescription.sdp = remoteDescription.sdp.replaceAll(/(a=ice-ufrag:)(.*)\r\n/gm	, "$1" + iceUsername + "\r\n");
			remoteDescription.sdp = remoteDescription.sdp.replaceAll(/(a=ice-pwd:)(.*)\r\n/gm	, "$1" + icePassword + "\r\n");

			//Wait until the offer was set locally
			await sld;

			//Set it
			this.pc.setRemoteDescription(remoteDescription);
		}
	}

	async stop()
	{
		//Cancel any pending timeout
		this.iceTrickeTimeout = clearTimeout(this.iceTrickeTimeout);

		//If we don't have the resource url
		if (!this.resourceURL)
			throw new Error("WHIP resource url not available yet");

		//Request headers
		const headers = {
		};

		//If token is set
		if (this.token)
			headers["Authorization"] = "Bearer " + this.token;

		//Send a delete
		await fetch(this.resourceURL, {
			method: "DELETE",
			headers
		});

		//Close peerconnection
		this.pc.close();

		//Null
		this.pc = null;
	}
};