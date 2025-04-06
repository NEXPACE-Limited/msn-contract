## Environment

- node 16.18.\*
- npm 8.19.\*
- solidity 0.8.\*

## Setup

`npm install`

## Usage

Compile

```shell
npm run compile
```

Run test code

```shell
npm test
```

Measure coverage after all test files are run

```shell
npm run coverage
```

## Convention

https://docs.soliditylang.org/en/v0.8.13/style-guide.html

### Full Layout

1. Pragma statements
2. Import statements
3. Interfaces
4. Libraries
5. **Contracts**

### Contract Layout

1. Type declarations
2. State variables
3. Events
4. Modifies
5. **Functions**

### Declaration order by function type

1. constructor
2. receive function (if exists)
3. fallback function (if exists)
4. external
5. public
6. internal
7. private