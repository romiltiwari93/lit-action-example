# Sign in with Google Lit Action Demo

This is a demo of how to do "Sign in with Google" using Lit Actions, as a workaround for the bug with Lit's native "Sign in with Google" implementation, which will be fixed in the next network update (ETA Apr 22nd).

# Usage

Make sure that you have a Private Key with Lit tokens and capacity credit NFTs in the `NEXT_PUBLIC_LIT_ROLLUP_MAINNET_DEPLOYER_PRIVATE_KEY` env var (delegation example coming next).

Install the dependencies with `npm install`.

Run the demo with `npm run dev` and open `http://localhost:3000` in your browser.

Click "Sign in with google" and follow the redirects. You'll be redirected to the app. Wait for the google token to appear on the main page. Open the developer console and click "Mint PKP and Sign" to sign a message with the PKP. You should see the signature in the console.

# What's happening here?

Since the native "Sign in with Google" is broken, we're using a workaround of a Lit Action that will check the Google token, and then check the PKP Permissions to check that the user is allowed to sign using that Google account. The Lit Action will only attempt to sign if the user is both authenticated and authorized.

When we mint the PKP, we add 2 auth methods: the regular Google one, and this Lit Action that is the Google workaround. Once the network update is deployed and "Sign in with Google" is working natively on the Lit Nodes, you can switch away from using this Lit Action, and auth will continue to work for your user, because the user will have the Google auth method set on their PKP.

# Next.js default docs

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
