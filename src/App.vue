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
 * @return {(string | {name: string; importAsName: string})[] }
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
      const _import = importItem.split(' as ').map(item => item.trim());

      vueImports.push(_import.length === 2 ? {
        name: _import.at(0),
        importAsName: _import.at(-1)
      }  : _import.at(0));
    });
  }

  return vueImports;
}

/**
 *
 * @param descriptor {import("@vue/compiler-sfc").SFCDescriptor}
 * @param id {string}
 * @return {function(...[*]): * | null}
 */
const processTemplate = async (descriptor, id) => {
  if (descriptor.template) {

    // Compile template to render function
    const { code, errors } = compileTemplate({
      source: descriptor.template.content,
      id
    });

    if (errors.length) throw errors;

    const depsToImport = getVueImportedDependencies(code);

    const vue = await import("vue");

    const importedDependencies = depsToImport.reduce((accum, dep) => {

      const isImportAs = typeof dep === "object";

      const vueImportName = isImportAs ? dep.name : dep;

      const usedImportName = isImportAs ? dep.importAsName : dep;

      if (vue[vueImportName]) accum = {...accum, [usedImportName]: vue[vueImportName]}
      return accum;
    }, {})

    let parsedTemplateContent = removeVueImports(code)

    parsedTemplateContent = parsedTemplateContent.replaceAll("export", "").trim()

    const renderFn = new Function('deps', `

      const {${Object.keys(importedDependencies).join(',')}} = deps;

       return ${parsedTemplateContent}
    `)(importedDependencies)

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
const processScript = async (descriptor, id) => {
  if (descriptor.script || descriptor.scriptSetup) {

    const storeVariable = 'ComponentScript'

    const {content} = compileScript(descriptor, {
      id,
      inlineTemplate: true,
      genDefaultAs: storeVariable
    })

    const parsedScriptContent = removeVueImports(content);

    const depsToImport = getVueImportedDependencies(content);

    const vue = await import("vue");

    const importedDependencies = depsToImport.reduce((accum, dep) => {

      const isImportAs = typeof dep === "object";

      const vueImportName = isImportAs ? dep.name : dep;

      const usedImportName = isImportAs ? dep.importAsName : dep;

      if (vue[vueImportName]) accum = {...accum, [usedImportName]: vue[vueImportName]}
      return accum;
    }, {})

    const script = new Function('deps', `

      const {${Object.keys(importedDependencies).join(',')}} = deps;

      ${parsedScriptContent}

      return ${storeVariable}
    `)(importedDependencies)

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

     const render = await processTemplate(descriptor, hash);

     let script = await processScript(descriptor, hash)

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
