import { serveStatic } from 'frog/serve-static';
import { Button, Frog } from 'frog';
import { handle } from 'frog/vercel';
import { devtools } from 'frog/dev';
import { ethers } from 'ethers';
import axios from 'axios';
import { fcLauncherAbi, fcLauncherAddress } from '../contracts/abi-fc-launcher.js';
import { tokenAbi } from '../contracts/abi-token.js';
import 'dotenv/config';
import sdk from '@farcaster/frame-sdk';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const provider = new ethers.AlchemyProvider(8453, process.env.ALCHEMY_KEY);

const getTicker = (text) => {
  const match = /@launcher launch \$([a-zA-Z0-9]+)/.exec(text);
  if (match) {
    return match[1];
  }
};

const testCast = "https://warpcast.com/owl/0x6864e592";

const lookupCast = async (identifier = testCast) => {
  const res = await axios.get(`https://api.neynar.com/v2/farcaster/cast?type=hash&identifier=${identifier}`, {
    headers: {
      'accept': 'application/json',
      'x-api-key': process.env.NEYNAR_KEY,
    }
  });
  return res.data;
};

const postCast = async (castHash) => {
  const res = await axios.post('https://api.neynar.com/v2/farcaster/cast', {
    "embeds": [{
      "url": `https://launcher-frame.vercel.app/api/${castHash}`
    }],
    "text": "",
    "parent": castHash,
    "signer_uuid": process.env.NEYNAR_UUID,
  }, {
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': process.env.NEYNAR_KEY,
    }
  });
};

const signArrayOfAddresses = async (addresses) => {
  const signer = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);

  if (!Array.isArray(addresses)) {
    throw new Error("Input must be an array of addresses");
  }

  // Encode the array of addresses
  const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address[]"],
    [addresses]
  );

  // Hash the encoded data
  const messageHash = ethers.keccak256(encodedData);

  // Sign the hash
  const signature = await signer.signMessage(ethers.getBytes(messageHash));

  return {
    messageHash,
    signature,
  };
};

const CONTRACT_ADDRESS = "0xDC324998F1cbf814e5e4Fa29C60Be0778A1B702A";

export const app = new Frog<{ State: State }>({
  assetsPath: '/',
  basePath: '/api',
  title: 'Launcher',
});

app.post('/webhook/mention', async (c) => {
  const json = await c.req.json();
  const ticker = getTicker(json.data.text);
  if (ticker) {
    const castHash = json.data.hash;
    await postCast(castHash);
  }
  return c.text('OK', 200);
});

app.get('/test', (c) => {
  return c.text('KK', 200);
});

const sectionStyles = {
  color: 'white',
  fontSize: 32,
  fontStyle: 'normal',
  letterSpacing: '-0.025em',
  lineHeight: 1.4,
  padding: '0px 60px',
  whiteSpace: 'pre-wrap',
  display: 'flex',
  textAlign: 'left'
};

const sectionHeaderStyles = Object.assign({}, sectionStyles, { fontSize: 60, paddingTop: '30px', marginTop: 30 });

app.frame('/:castHash', async (c) => {
  const castHash = c.req.param('castHash') || testCast;
  console.log('casthash',castHash);
  if (!castHash) {
    return c.res({
      image: (
        <div
          style={{
            alignItems: 'center',
            background: 'linear-gradient(to right, #432889, #17101F)',
            backgroundSize: '100% 100%',
            display: 'flex',
            flexDirection: 'column',
            flexWrap: 'nowrap',
            height: '100%',
            justifyContent: 'center',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div style={sectionHeaderStyles}>Cast Not Found ⚠️</div>
        </div>
      ),
      intents: [
      ],
    });
  }

  const contract = new ethers.Contract(fcLauncherAddress, fcLauncherAbi, provider);
  const tokenAddress = await contract.getCastToken(castHash);
  if (tokenAddress != NULL_ADDRESS) {
    const token = new ethers.Contract(tokenAddress, tokenAbi, provider);
    const image = await token.image();
    const ticker = await token.symbol();
    return c.res({
      image: (
        <div
          style={{
            alignItems: 'center',
            background: 'linear-gradient(to right, #432889, #17101F)',
            backgroundSize: '100% 100%',
            display: 'flex',
            flexDirection: 'column',
            flexWrap: 'nowrap',
            height: '100%',
            justifyContent: 'center',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div style={sectionHeaderStyles}>${ticker} launched</div>
          <img style={{ backgroundColor: 'black', width: '200px', height: '200px', objectFit: 'contain', marginTop: '40px', borderRadius: '500px', border: '3px solid #ccc'}} src={image} />
          <div style={sectionHeaderStyles}>Interact with it below</div>
        </div>
      ),
      intents: [
        <Button.Redirect location={`https://dexscreener.com/base/${tokenAddress}`}>Trade</Button.Redirect>,
        <Button.Redirect location={`https://www.rebase.finance/${tokenAddress}`}>LP</Button.Redirect>,
        <Button.Redirect location={`https://www.based.jobs/project/${tokenAddress}`}>Earn</Button.Redirect>,
      ],
    })
  } else {
    const castRes = await lookupCast(castHash);
    const ticker = getTicker(castRes.cast.text);
    const image = castRes.cast.embeds && castRes.cast.embeds.length > 0
      ? castRes.cast.embeds[0].url
      : "https://i.imgur.com/ShRHsoG.png";
    const linkedAddresses = castRes.cast.author.verified_addresses.eth_addresses;
    const author = castRes.cast.author.username;

    return c.res({
      image: (
        <div
          style={{
            alignItems: 'center',
            background: 'linear-gradient(to right, #432889, #17101F)',
            backgroundSize: '100% 100%',
            display: 'flex',
            flexDirection: 'column',
            flexWrap: 'nowrap',
            height: '100%',
            justifyContent: 'flex-start',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div style={sectionHeaderStyles}>Launch ${ticker}</div>
          <img style={{ backgroundColor: 'black', width: '200px', height: '200px', objectFit: 'contain', marginTop: '40px', borderRadius: '500px', border: '3px solid #ccc'}} src={image} />
          <div style={{marginTop: '30px', ...sectionStyles}}>Use an address linked to @{author}:</div>
          <div style={sectionStyles}>
            {(linkedAddresses || []).join('\n')}
          </div>
        </div>
      ),
      intents: [
        <Button.Transaction target={`/launch/${castHash}`}>Launch</Button.Transaction>,
        <Button>Refresh&nbsp;&nbsp;🔄</Button>,
      ],
    });
  }
});

app.transaction('/launch/:castHash', async (c) => {
  const castHash = c.req.param('castHash');
  const castRes = await lookupCast(castHash);
  const image = castRes.cast.embeds && castRes.cast.embeds.length > 0
    ? castRes.cast.embeds[0].url
    : "https://i.imgur.com/ShRHsoG.png";
  const ticker = getTicker(castRes.cast.text);
  const name = ticker;
  const linkedAddresses = castRes.cast.author.verified_addresses.eth_addresses;
  const { signature } = await signArrayOfAddresses(linkedAddresses);
  const contract = new ethers.Contract(fcLauncherAddress, fcLauncherAbi, provider);
  const txnValue = await contract.getLaunchCost();
  return c.contract({
    abi: fcLauncherAbi,
    chainId: 'eip155:8453',
    functionName: 'launch',
    args: [
      ticker,
      name,
      image,
      castHash,
      linkedAddresses,
      signature
    ],
    value: txnValue,
    to: fcLauncherAddress,
  })
});

if (import.meta.env?.MODE === 'development') devtools(app, { serveStatic });
else devtools(app, { assetsPath: '/.frog' });

export const GET = handle(app);
export const POST = handle(app);
