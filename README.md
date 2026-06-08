# web-boiler

A minimal Aztec frontend boilerplate (Vite + React 19 + TypeScript + Tailwind 4): connect to an Aztec node and wallet, and read the chain.

## Run

Requires Node.js and Yarn (use yarn, not npm).

```sh
yarn install
yarn dev
```

Open the URL it prints. It connects to the public Aztec testnet out of the box; to use a different node, set the `VITE_AZTEC_NODE_URL` environment variable before running.

## Scripts

```sh
yarn dev       # start the dev server
yarn build     # production build
yarn preview   # serve the production build
yarn lint      # run eslint
```
