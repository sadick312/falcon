# Falcon V1.0.0

A high performance, stable, low-latency custom client for MooMoo.io. 
Built from the ground up, the client offers high-level automation features as well as QoL improvements. 
With over 50+ toggles, the client offers customization for all play styles.
> Client is unpatched for v1.9.0 but not optimized for v1.9.0 combat.

## Installation
Below are the instructions to download a local copy of the client.

### Prerequisites
- Node.js
- NPM
- Terminal
- Working Keyboard
- 3 Micro Braincells

### Installation Instructions
1. Run ```npm install``` to install all dependencies.
2. Run ```npm run mod:build``` to bundle the mod code.
3. Run ```npm run ext:build``` to build the extension. It copies the mod bundle into the extension.
4. Open ```chrome://extensions```, enable Developer mode, choose "Load unpacked" and select ```falcon-launcher/dist```.

After changing mod code, run steps 2 and 3 again and reload the extension.

## Contribution / Code Modification
This specific project is **NOT** opened to community contributions.

## License
This project is licensed under GNU GPLv3.
> For more information about **GNU GPLv3**, click [here](https://choosealicense.com/licenses/gpl-3.0/).