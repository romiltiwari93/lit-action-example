import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { LitAbility, LitPKPResource } from '@lit-protocol/auth-helpers';
import { AuthMethodScope, ProviderType } from '@lit-protocol/constants';
import { LitAuthClient } from '@lit-protocol/lit-auth-client';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { IRelayPKP } from '@lit-protocol/types';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';

const inter = Inter({ subsets: ["latin"] });

export default function Home() {

  const stuff = async ({
    litNetwork,
    relayApiKey,
    capacityCreditsPrivateKey,
  }: {
    litNetwork: string;
    relayApiKey: string;
    capacityCreditsPrivateKey: string;
  }) => {
    const wallet = ethers.Wallet.createRandom();
  
    const litNodeClient = new LitNodeClient({
      litNetwork,
      debug: false,
    });
  
    await litNodeClient.connect();
  
    const litAuthClient = new LitAuthClient({
      litNodeClient,
      litRelayConfig: { relayApiKey },
    });
  
    const authProvider = litAuthClient.initProvider(ProviderType.EthWallet);
  
    const authMethod = await authProvider.authenticate({
      address: wallet.address,
      signMessage: (message: string) => wallet.signMessage(message),
      chain: 'ethereum',
      // expiration: '',
    });
  
  
    console.log(555, { wallet });
    
    const txHash = await authProvider.mintPKPThroughRelayer(authMethod, {
      keyType: 2,
      permittedAuthMethodTypes: [authMethod.authMethodType],
      permittedAuthMethodIds: [wallet.address],
      permittedAuthMethodPubkeys: ['0x'],
      permittedAuthMethodScopes: [[AuthMethodScope.SignAnything]],
      addPkpEthAddressAsPermittedAddress: false,
      sendPkpToItself: false,
    });
  
    const res = await authProvider.relay.pollRequestUntilTerminalState(txHash);
  
    if (!res.pkpTokenId || !res.pkpPublicKey || !res.pkpEthAddress)
      throw new Error('Mint PKP fail');
  
    const pkp: IRelayPKP = {
      tokenId: res.pkpTokenId,
      publicKey: res.pkpPublicKey,
      ethAddress: res.pkpEthAddress,
    };
  
    console.log(555, { pkp });
  
    const capacityCreditsWallet = new ethers.Wallet(capacityCreditsPrivateKey);
  
    const capacityCreditsRes =
      await litNodeClient.createCapacityDelegationAuthSig({
        dAppOwnerWallet: capacityCreditsWallet,
        uses: "100"
      });
  
    console.log('creating session sigs with auth method', authMethod);
  
  /**
   * When the getSessionSigs function is called, it will generate a session key
   * and sign it using a callback function. The authNeededCallback parameter
   * in this function is optional. If you don't pass this callback,
   * then the user will be prompted to authenticate with their wallet (in the browser).
   */
  const authNeededCallback = async ({ chain, resources, expiration, uri, nonce }: {
    chain: string;
    resources?: string[];
    expiration?: string;
    uri?: string;
    nonce: string;
  }) => {
    const domain = "localhost:3000";
    const message = new SiweMessage({
      domain,
      address: wallet.address,
      statement: "Sign a session key to use with Lit Protocol",
      uri,
      version: "1",
      chainId: 1,
      expirationTime: expiration,
      resources,
      nonce,
    });
    const toSign = message.prepareMessage();
    const signature = await wallet.signMessage(toSign);
  
    const authSig = {
      sig: signature,
      derivedVia: "web3.eth.personal.sign",
      signedMessage: toSign,
      address: wallet.address,
    };
  
    return authSig;
  };
  
  // get session sigs from local wallet
  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: "ethereum",
    resourceAbilityRequests: [
      {
        resource: new LitPKPResource('*'),
            ability: LitAbility.PKPSigning,
      }
    ],
    authNeededCallback,
    capacityDelegationAuthSig: capacityCreditsRes.capacityDelegationAuthSig,  // here is where we add the delegation to our session request
  });
  
    console.log('session sigs created', 555, { sessionSigs });
  
    const pkpWallet = new PKPEthersWallet({
      controllerSessionSigs: sessionSigs,
      pkpPubKey: pkp.publicKey,
      litNetwork
    });
    await pkpWallet.init();
  
    const signature = await pkpWallet.signMessage('Hello, world!');
  
    console.log(555, { signature });
  }

  const buttonClicked = async () => {
  
    await stuff({
      litNetwork: 'habanero',
      relayApiKey: 'test_its_chris',
      capacityCreditsPrivateKey: process.env.NEXT_PUBLIC_LIT_ROLLUP_MAINNET_DEPLOYER_PRIVATE_KEY!
    }).catch((e) => {
      console.error(e);
    });
  }

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main} ${inter.className}`}>
        <div className={styles.description}>
          <button onClick={buttonClicked}>Click me</button>
        </div>
      </main>
    </>
  );
}
