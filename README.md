# vue-runtime-compilation

Project showcases how Vue.js single file component code can be compiled and render in a runtime (skipping build step) and shown on the display

## Project Setup

### Node version
Project is using node version v22.0.0 ``` nvm use v22.0.0 ```

### Run the project

```sh
npm run dev
```

### How to use 

    There is a REPL (read evaluate print loop) for Vue code,
    that accepts Vue source code and handles compilation
    and renders Vue code in a runtime.
    
    @vue/sfc-compiler package is used to handle runtime compilation

#### Something that is not working now:
 Some features like 
