Apologies for the oversight earlier. Here's the professional-looking `README.md` as per your request:

---

# Mockup Blackmagic Videohub Server

[![NPM Version](https://img.shields.io/npm/v/@bitfocus/mockup-bmd-videohub.svg)](https://www.npmjs.com/package/@bitfocus/mockup-bmd-videohub)
[![License](https://img.shields.io/npm/l/@bitfocus/mockup-bmd-videohub.svg)](LICENSE)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Donate](https://img.shields.io/badge/donate-donorbox-blue.svg)](https://donorbox.org/bitfocus-opensource)

A mockup server that emulates the Blackmagic Videohub Ethernet Protocol v2.3, allowing you to test and develop applications without access to actual hardware.

## Features

- Emulates the Blackmagic Videohub Ethernet Protocol v2.3
- Configurable number of inputs and outputs (IO ports)
- Customizable listening port
- Ideal for testing and development purposes

## Installation

You can run the mockup server directly using `npx`:

```bash
npx @bitfocus/mockup-bmd-videohub
```

Alternatively, install it globally:

```bash
npm install -g @bitfocus/mockup-bmd-videohub
```

## Usage

### Environment Variables

- `IO`: Sets the number of input/output ports (default: `128`).
- `PORT`: Sets the listening port for the server (default: `9990`).

### Running the Server

To start the server with default settings:

```bash
npx @bitfocus/mockup-bmd-videohub
```

To specify the number of IO ports and the listening port:

```bash
IO=128 PORT=9991 npx @bitfocus/mockup-bmd-videohub
```

Example with custom settings:

```bash
export IO=64
export PORT=9992
npx @bitfocus/mockup-bmd-videohub
```

Or in one line:

```bash
IO=64 PORT=9992 npx @bitfocus/mockup-bmd-videohub
```

The server will start and announce:

```bash
Starting server with 64 IOs
Successfully bound 9992
```

## Contributing

We welcome contributions from the community!

- **Bug Reports & Feature Requests:** Please use the [issue tracker](https://github.com/bitfocus/mockup-bmd-videohub/issues) to report any bugs or request new features.
- **Pull Requests:** Feel free to fork the repository and submit pull requests for improvements.

## Support

If you find this project helpful and would like to support its development, please consider [making a donation](https://donorbox.org/bitfocus-opensource).

Your support helps us maintain and improve this open-source project.

## License

This project is licensed under the [MIT License](LICENSE).

## Author

Developed by William Viker (<william@bitfocus.io>) on behalf of [Bitfocus AS](https://bitfocus.io).