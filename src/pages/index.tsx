import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useEffect, useState } from "react";
import {
  LitAbility,
  LitPKPResource,
  RecapSessionCapabilityObject,
  newSessionCapabilityObject,
} from "@lit-protocol/auth-helpers";
import { ProviderType, AuthMethodScope } from "@lit-protocol/constants";
import {
  GoogleProvider,
  LitAuthClient,
  isSignInRedirect,
} from "@lit-protocol/lit-auth-client";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { IRelayPKP, AuthMethod } from "@lit-protocol/types";
import { ethers } from "ethers";
import { SiweMessage } from "siwe";
import IpfsHash from "ipfs-only-hash";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { computeAddress } from "ethers/lib/utils";
import { AuthCallbackParams } from "@lit-protocol/types";

const inter = Inter({ subsets: ["latin"] });

const getAuthSig = async (pkpPublicKey: string) => {
  const privateKey =
    process.env.NEXT_PUBLIC_LIT_ROLLUP_MAINNET_DEPLOYER_PRIVATE_KEY!;
  const wallet = new ethers.Wallet(privateKey);
  const address = await wallet.getAddress();

  // Craft the SIWE message
  const domain = "localhost";
  const origin = "https://localhost/login";
  const statement =
    "This is a test statement.  You can put anything you want here.";
  let siweMessage = new SiweMessage({
    domain,
    address: address,
    statement,
    uri: origin,
    version: "1",
    chainId: 1,
    expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  const sessionCapabilityObject = new RecapSessionCapabilityObject({}, []);
  const litPkpResource = new LitPKPResource(pkpPublicKey);
  sessionCapabilityObject.addCapabilityForResource(
    litPkpResource,
    LitAbility.PKPSigning
  );
  siweMessage = sessionCapabilityObject.addToSiweMessage(siweMessage);

  const messageToSign = siweMessage.prepareMessage();

  // Sign the message and format the authSig
  const signature = await wallet.signMessage(messageToSign);

  const authSig = {
    sig: signature,
    derivedVia: "web3.eth.personal.sign",
    signedMessage: messageToSign,
    address: address,
  };

  return authSig;
};

const getSessionSigs = async (
  pkpPublicKey: string,
  litNodeClient: LitNodeClient,
  authMethodId: number,
  accessToken: string
) => {
  //get capacity delegation auth sig to facilitate signing from nodes
  const ethAddress = computeAddress(pkpPublicKey);
  /* const capacityDelegationAuthSig =
    await getCapacityDelegationAuthSig(ethAddress); */
  const sessionKeyPair = litNodeClient.getSessionKey();

  //AuthSig Callback
  const authNeededCallback = async (params: AuthCallbackParams) => {
    const response = await litNodeClient.signSessionKey({
      sessionKey: sessionKeyPair,
      authMethods: [
        {
          authMethodType: authMethodId,
          accessToken,
        },
      ],
      pkpPublicKey: pkpPublicKey,
      expiration: params.expiration,
      resources: params.resources,
      chainId: 1,
    });
    return response.authSig;
  };

  //SIWE ReCap Object
  const sessionCapabilityObject = newSessionCapabilityObject();
  const litPkpResource = new LitPKPResource(pkpPublicKey);
  sessionCapabilityObject.addCapabilityForResource(
    litPkpResource,
    LitAbility.PKPSigning
  );

  //Generate session signatures
  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: "ethereum",
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    resourceAbilityRequests: [
      {
        resource: litPkpResource,
        ability: LitAbility.PKPSigning,
      },
    ],
    sessionKey: sessionKeyPair,
    authNeededCallback,
    sessionCapabilityObject,
  });
  return sessionSigs;
};

const LIT_NETWORK = "manzano";
const LIT_RELAY_API_KEY = "test_its_chris";
const GOOGLE_REDIRECT_URI = "http://localhost:3000";

export default function Home() {
  const [litNodeClient, setLitNodeClient] = useState<LitNodeClient | null>(
    null
  );
  const [litAuthClient, setLitAuthClient] = useState<LitAuthClient | null>(
    null
  );
  const [resolvedAuthMethod, setResolvedAuthMethod] =
    useState<AuthMethod | null>(null);

  useEffect(() => {
    const go = async () => {
      if (!litNodeClient) {
        const _litNodeClient = new LitNodeClient({
          litNetwork: LIT_NETWORK,
          debug: true,
        });

        await _litNodeClient.connect();
        setLitNodeClient(_litNodeClient);
        console.log("Lit Node Client connected");
      }

      if (!litAuthClient) {
        const _litAuthClient = new LitAuthClient({
          litNodeClient,
          litRelayConfig: {
            relayApiKey: LIT_RELAY_API_KEY,
            relayUrl: "https://manzano-relayer.getlit.dev",
          },
        });
        // Initialize Google provider
        _litAuthClient!.initProvider(ProviderType.Google, {
          // The URL of your web app where users will be redirected after authentication
          redirectUri: GOOGLE_REDIRECT_URI,
        });
        setLitAuthClient(_litAuthClient);

        // check if we are in the google redirect flow
        // Check if app has been redirected from Lit login server
        if (isSignInRedirect(GOOGLE_REDIRECT_URI)) {
          // Get the provider that was used to sign in
          const provider = _litAuthClient.getProvider(ProviderType.Google)!;
          // Get auth method object that has the OAuth token from redirect callback
          const authMethod = await provider.authenticate();
          console.log("Auth method resolved: ", authMethod);
          console.log("Access token: ", authMethod.accessToken);
          setResolvedAuthMethod(authMethod);
        }
      }
    };
    go();
  }, []);

  // const getCapacityCreditDelegationSig = async () => {
  //   const privateKey =
  //     process.env.NEXT_PUBLIC_LIT_ROLLUP_MAINNET_DEPLOYER_PRIVATE_KEY!;
  //   const capacityCreditsWallet = new ethers.Wallet(privateKey);

  //   const capacityCreditsRes =
  //     await litNodeClient!.createCapacityDelegationAuthSig({
  //       dAppOwnerWallet: capacityCreditsWallet,
  //       uses: "100",
  //     });

  //   return capacityCreditsRes.capacityDelegationAuthSig;
  // };

  const signInToGoogle = async () => {
    const provider = litAuthClient!.getProvider(
      ProviderType.Google
    )! as GoogleProvider;
    await provider.signIn();
  };

  const mintPKPAndSign = async () => {
    const litActionCode = `
    const checkGoogleAuth = async () => {
      console.log("Downloading google keys");
        const resp = await fetch("https://www.googleapis.com/oauth2/v3/certs");
        const jsonResp = await resp.json();
        console.log("Google keys downloaded: ", jsonResp);
        const keys = jsonResp.keys;

        // parse the jwt
        const decoded = jwt.decode(googleToken, { complete: true });
        const header = decoded.header;
        const kid = header.kid;
        console.log("JWT parsed");

        // find the key
        const key = keys.find((k) => k.kid === kid);
        console.log("Found key: ", key);

        // convert the key so it can be used by the JWT library
        delete key.alg;
        const subtleImportedKey = await crypto.subtle.importKey(
          "jwk",
          key,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"]
        );
        const publicKey = await crypto.subtle.exportKey(
          "spki",
          subtleImportedKey
        );
        let body = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
        body = body.match(/.{1,64}/g).join("\\n");
        const pemKey =
          "-----BEGIN PUBLIC KEY-----\\n" + body + "\\n-----END PUBLIC KEY-----";
        console.log("Key converted");
        const payload = jwt.verify(googleToken, pemKey, { algorithms: ["RS256"] });
        console.log("JWT verified");
        return payload;
      }

      const go = async () => {
        // check if they're authenticated.  checkGoogleAuth will throw an error if they're not.
        const googleUserInfo = await checkGoogleAuth();
        console.log("Google user info: ", googleUserInfo);
        const googleUserId = googleUserInfo.sub;
        const googleAppId = googleUserInfo.aud;
        const authMethodId = ethers.utils.arrayify(ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes(googleUserId + ":" + googleAppId)
        ));
        console.log('authMethodId: ', authMethodId);
        // check if they're authorized
        const isAuthorized = await Lit.Actions.isPermittedAuthMethod({tokenId: pkpTokenId, authMethodType: "854321", userId: authMethodId})
        console.log("Is authorized: ", isAuthorized);
        if (!isAuthorized) {
          Lit.Actions.setResponse({response: "Unauthorized"});
          return;
        }
        Lit.Actions.signEcdsa({publicKey: pkpPublicKey, toSign, sigName: 'sig1'})
      }
      go();
    `;

    const litActionHash = await IpfsHash.of(litActionCode);
    const litContracts = new LitContracts();
    const litActionHashAsBytes =
      litContracts.utils.getBytesFromMultihash(litActionHash);

    const provider = litAuthClient!.getProvider(
      ProviderType.Google
    )! as GoogleProvider;
    const authMethodId = await provider.getAuthMethodId(resolvedAuthMethod!);
    const txHash = await provider.mintPKPThroughRelayer(resolvedAuthMethod!, {
      keyType: 2,
      permittedAuthMethodTypes: [854321, 2],
      permittedAuthMethodIds: [authMethodId, litActionHashAsBytes],
      permittedAuthMethodPubkeys: ["0x", "0x"],
      permittedAuthMethodScopes: [
        [AuthMethodScope.SignAnything],
        [AuthMethodScope.SignAnything],
      ],
      addPkpEthAddressAsPermittedAddress: true,
      sendPkpToItself: true,
    });

    const res = await provider.relay.pollRequestUntilTerminalState(txHash);

    if (!res.pkpTokenId || !res.pkpPublicKey || !res.pkpEthAddress)
      throw new Error("Mint PKP fail");

    const pkp: IRelayPKP = {
      tokenId: res.pkpTokenId,
      publicKey: res.pkpPublicKey,
      ethAddress: res.pkpEthAddress,
    };

    console.log("PKP minted: ", pkp);

    // this auth sig is only used for rate limiting.  it must hold rate limit NFTs
    //const authSig = await getAuthSig(pkp.publicKey);
    const sessionSigs = await getSessionSigs(
      pkp.publicKey,
      litNodeClient!,
      854321,
      resolvedAuthMethod!.accessToken
    );

    const resp = await litNodeClient!.executeJs({
      sessionSigs,
      code: litActionCode,
      jsParams: {
        googleToken: resolvedAuthMethod!.accessToken,
        pkpTokenId: pkp.tokenId,
        pkpPublicKey: pkp.publicKey,
        toSign: ethers.utils.arrayify(
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"))
        ),
      },
    });
    console.log("Lit action executed: ", resp);
    const sig = resp.signatures.sig1.signature;
    console.log("Signature: ", sig);
  };

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main} ${inter.className}`}>
        <div>
          <button onClick={signInToGoogle}>Sign in to Google</button>
          <br />
          <br />
          <div style={{ maxWidth: "500px" }}>
            Auth method present:{" "}
            {resolvedAuthMethod ? JSON.stringify(resolvedAuthMethod) : "None"}
          </div>
          <button onClick={mintPKPAndSign}>Mint PKP and Sign</button>
        </div>
      </main>
    </>
  );
}
