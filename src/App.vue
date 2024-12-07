<template>
  <div>
    <main>
      <div class="flex">
        <section class="flex-1">
          <header class="flex justify-between">
            <div class="flex">
              <div
                  class="text-green-600 border-b border-b-green-600 py-2 px-4"
                  v-for="file in sfcFiles"
                  :key="file.name"
              >
                <button>
                  {{ file.name }}
                </button>
              </div>
            </div>
          </header>
          <div>
            <div class="code-container">
              <vue-monaco-editor
                style="height: 500px; width: 100%"
                v-model:value.lazy="code"
                theme="vs-dark"
                language="html"
                :options="{
                  automaticLayout: true,
                  formatOnType: true,
                  formatOnPaste: true,
                }"
              />
            </div>
          </div>
        </section>
        <section class="flex-1">
          <header>
            <div class="py-2 px-4">Preview</div>
          </header>
          <div class="result">
            <iframe height="500px" id="vue" frameborder="0" />
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import VueMonacoEditor from "@guolao/vue-monaco-editor";
import {
  compileScript,
  compileTemplate,
  parse,
  compileStyle,
} from "@vue/compiler-sfc";
import * as Vue from "vue";
import { onMounted, ref, watch } from "vue";
import { createApp } from "@vue/runtime-dom";

const defaultCode = `
  <template>
    <div>
        <h1>Vue.js Repl</h1>
    </div>
</template>

<style>
body {
background-color: white;
}

div:has(h1) {
    text-align: center
}
</style>
`

const code = ref(defaultCode);

const sfcFiles = ref([
  {
    name: "App.vue",
  },
]);


/**
 * @description Returns Vue application root element,
 * which is div#app by default
 * @return {HTMLDivElement}
 */
const getVueRoot = () => {
  return document
    .querySelector("iframe")
    .contentDocument.body.querySelector("#app");
};

function removeExportDefault(inputString) {
  return inputString.replace(/export\s+default\s+/g, "");
}

/**
 * @description Removes all dependencies import from "vue" package
 * @param code {string}
 * @return {string}
 *
 * @example
 *  const script = `
 *    import {ref} from "vue"
 *
 *    const count = ref(1);
 *  `
 *
 *  const scriptWithoutImports = removeVueImports(script);
 *    // const count = ref(1)
 *    // So imports are not removed
 */
function removeVueImports(code) {
  const importRegex = /import\s*{[^}]+}\s*from\s*"vue";?/g;

  return code.replace(importRegex, '');
}


/**
 * @description Allows to retrieve list of imported dependencies from the code
 * @param code {string}
 * @return {string[]}
 *
 * @example
 *
 * const script = `
 *  import {ref, computed} from "vue"
 * `
 *
 * const dependencies = getVueImportedDependencies(script)
 *
 * // dependencies - ["ref", "computed"]
 */
function getVueImportedDependencies(code) {
  const importRegex = /import\s*{([^}]+)}\s*from\s*"vue"/g;

  const vueImports = [];

  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const imports = match[1].split(',').map(item => item.trim());
    imports.forEach(importItem => {
      const importedAsName = importItem.split(' as ').map(item => item.trim()).at(-1);
      vueImports.push(importedAsName);
    });
  }

  return vueImports;
}


/**
 * @description Replaces all uses of dependencies from "vue" package
 * to with namespaces use
 * @param code {string}
 * @return {string}
 *
 * @example
 *
 * const script = `
 *  import {openBlock as _openBlock} from "vue"
 *
 *  function render() {
 *    (_openBlock());
 *  }
 * `
 *
 * const processedScript = replaceImportsWithVue(script)
 *  /* Becomes:
 *     function render() {
 *       (Vue.openBlock());
 *     }
 *  /
 */
function replaceImportsWithVue(code) {
  const dependencies = getVueImportedDependencies(code)

  dependencies.forEach(dependency => {

    const isImportAs = dependency.startsWith("_")

    code = code.replaceAll(dependency,dependency => `Vue.${isImportAs ? dependency.substring(1) : dependency}`)
  })

  return code;
}


/**
 *
 * @param descriptor {import("@vue/compiler-sfc").SFCDescriptor}
 * @param id {string}
 * @return {function(...[*]): * | null}
 */
const processTemplate = (descriptor, id) => {
  if (descriptor.template) {

    // Compile template to render function
    const { code, errors } = compileTemplate({
      source: descriptor.template.content,
      id
    });

    if (errors.length) throw errors;

    let parsedTemplateContent = replaceImportsWithVue(code)

    parsedTemplateContent = removeVueImports(parsedTemplateContent)

    parsedTemplateContent = parsedTemplateContent.replaceAll("export", "").trim()

    const renderFn = ((...args) => {

      const renderFnString = parsedTemplateContent.replace("function", "return function");

      return new Function('Vue', renderFnString)(Vue)(...args)
    })

    return renderFn;
  }
  return null;
}


/**
 *
 * @param descriptor {import("@vue/compiler-sfc").SFCDescriptor}
 * @param id {string}
 * @return {function(...[*]): * | {}}
 */
const processScript = (descriptor, id) => {
  if (descriptor.script || descriptor.scriptSetup) {

    const { content} = compileScript(descriptor, {
      id
    });

    let parsedScriptContent = removeExportDefault(content);

    parsedScriptContent = replaceImportsWithVue(parsedScriptContent)

    parsedScriptContent = removeVueImports(parsedScriptContent)

    const script = new Function(`
    const setup = ${parsedScriptContent};
    return setup;
  `)();

    return script;
  }
  return {}
}

/**
 *
 * @param descriptor {import("@vue/compiler-sfc").SFCDescriptor}
 * @param id {string}
 * @return {null|string}
 */
const processStyles = (descriptor, id) => {
  if (descriptor.styles) {

    return descriptor.styles.reduce((css, styleBlock) => {

      const {code, errors} = compileStyle({
        id,
        source: styleBlock.content,
        scoped: styleBlock.scoped
      })

      if (errors.length) throw errors;

      return (css + '\n' + code).trim();
    }, "")
  }
  return null;
}

/**
 * @param document {Document}
 * @param component {import("vue").ComponentPublicInstance}
 * @param styles {string}
 */
const loadComponentCSS = (document, component, styles) => {
  if (component) {

    const cssBlob = new Blob([styles], {type: "text/css"})

    const url = URL.createObjectURL(cssBlob)

    const link = document.createElement("link")

    link.rel = "stylesheet"
    link.type = "text/css"
    link.href = url;

    link.onload = () => {
      URL.revokeObjectURL(url)
    }

    document.head.append(link, url)
  }
}

let appInstance = null;
  async function compileAndRender(vueCode, mountPoint, componentName) {

  if (appInstance) appInstance.unmount()

  const { descriptor } = parse(vueCode);

   try {
     const hash = 'hash' //Change

     const render = processTemplate(descriptor, hash);

     let script = processScript(descriptor, hash)

     const styles = processStyles(descriptor, hash);

     script.__name = componentName;
     script.render = render;

     appInstance = createApp(script);

     const component = appInstance.mount(mountPoint);

     if (component) loadComponentCSS(mountPoint.ownerDocument, component, styles)
   }
   catch(e) {
     console.error("Compilation error")
   }
}

const injectVueAnchor = () => {
  const frame = document.querySelector("#vue");

  const anchor = document.createElement("div");

  anchor.id = "app";

  frame.contentDocument.body.appendChild(anchor);

  return anchor;
};


watch(code, (sfcComponentCode) => {
  compileAndRender(sfcComponentCode, getVueRoot());
})

onMounted(() => {
  injectVueAnchor();
  compileAndRender(code.value, getVueRoot())
});
</script>

<style scoped>
.code-container {
  height: 500px;
}

.code-container > div[contenteditable] {
  height: 100%;
}

.code-container > div[contenteditable]:active {
  border: none;
  outline: none;
}
.code-container > div[contenteditable]:focus {
  border: none;
  outline: none;
}

.sfc-blocks-container {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.sfc-blocks-container > div {
  flex: 1;
}

.code-block .code-container {
  border: 2px solid dimgrey;
}

.result {
  width: 100%;
  border: 2px solid dimgrey;
}

iframe {
width: 100%;
}
</style>
