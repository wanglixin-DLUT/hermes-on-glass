# aiui-nerv-terminal

Rokid AIUI client for `dsh-nerv-bridge`.

## Configure

Edit `app.js`:

```js
bridgeUrl: 'wss://YOUR-TUNNEL-DOMAIN/glasses',
bridgeToken: 'CHANGE-ME',
```

`bridgeUrl` is the public WSS endpoint of the Mac mini bridge. `bridgeToken` is
the `sharedSecret` from `dsh-nerv-bridge/cordis.patch.yml`.

## Build

```bash
npm install
npx tsc --noEmit
aix pack . -o ../dist/aiui-nerv-terminal.aix --optimize
```

## Placeholder logo

`assets/logo.placeholder.png` is an original placeholder. Replace it with your
own local NERV asset if you want, but do not commit copyrighted NERV artwork to
a public repository.
