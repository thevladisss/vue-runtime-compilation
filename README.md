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

    This is a full blown Vue.js REPL (read evaluate print loop).
    It accepts Vue source code and handles runtime compilation
    and render.
    
    @vue/sfc-compiler package is used to handle runtime compilation

**Example usage:**
```vue
<template>
  <div>
    {{ count }}
    <button @click="count++">Increase</button>
  </div>
</template>

<script setup>
import {ref} from "vue"

const count = ref(0);  
</script>

<style>
  button {
    color: blue;
  }
</style>
```

**Output:**

![img.png](ReplExample.png)

Clicking on increase should be updating the count as any Vue code would in a normal environment

### What is not supported
    
-  Typescript setup block
    ```vue
    <script lang="ts"></script>
    ```
    
    In order for TS setup block to work, we would need to be able to transpire TS code to JS in a runtime


-  Style block with preprocessors
    ```vue
        <style lang="scss"></style>
    ```
   Appropriate pre-processors should be running in a runtime to transpile code into native CSS


