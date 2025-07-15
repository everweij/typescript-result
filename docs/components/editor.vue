<template>
  <div>
    <div
      style="margin-top: 2rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">
      <h1>Playground</h1>
      <div>
        <button @click="saveToUrl"
          style="padding: 8px 16px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">
          Save to URL
        </button>
        <button @click="resetEditor"
          style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reset
        </button>
      </div>

    </div>

    <div ref="editor" id="editor-target" style="width: 100%; height: calc(100dvh - 300px);"></div>
    <Toaster />
  </div>
</template>

<script setup>
import { shikiToMonaco } from '@shikijs/monaco'
import { ref, onMounted } from 'vue';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { createHighlighter } from 'shiki';
import * as prettier from 'prettier/standalone';
import prettierPluginTypescript from 'prettier/plugins/typescript';
import prettierPluginEstree from 'prettier/plugins/estree';
import typescriptResultTypes from '../../dist/index.d.ts?raw';
import { Toaster, toast } from 'vue-sonner';
import 'vue-sonner/style.css'

function formatCode(code) {
  return prettier.format(code, {
    parser: 'typescript',
    plugins: [prettierPluginTypescript, prettierPluginEstree],
    printWidth: 80,
    tabWidth: 2,
    singleQuote: false,
    trailingComma: 'es5',
  });
}

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

let editorInstance = null;
let defaultContent = '';

function saveToUrl() {
  if (editorInstance) {
    const content = editorInstance.getValue();
    const encoded = btoa(encodeURIComponent(content));
    const url = new URL(window.location);
    url.searchParams.set('code', encoded);
    const newUrl = url.toString();

    navigator.clipboard.writeText(newUrl)
      .then(() => {
        toast.success('URL copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy to clipboard:', err);
        toast.error('Failed to copy URL to clipboard');
      });

    window.history.replaceState({}, '', url);
  }
}

function loadFromUrl() {
  const url = new URL(window.location);
  const encoded = url.searchParams.get('code');
  if (encoded) {
    try {
      return decodeURIComponent(atob(encoded));
    } catch (error) {
      console.error('Failed to decode URL content:', error);
    }
  }
  return null;
}

function resetEditor() {
  if (editorInstance && defaultContent) {
    editorInstance.setValue(defaultContent);

    const url = new URL(window.location);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url);
  }
}

onMounted(async () => {
  const highlighter = await createHighlighter({
    themes: [
      'github-light',
      'github-dark',
    ],
    langs: [
      'javascript',
      'typescript',
    ],
  })

  monaco.languages.register({ id: 'typescript' })
  monaco.languages.register({ id: 'javascript' })
  monaco.languages.typescript.typescriptDefaults.addExtraLib(typescriptResultTypes, 'file:///node_modules/typescript-result/index.d.ts');
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    strict: true,
    types: ['node'],
  });

  shikiToMonaco(highlighter, monaco)

  const editor = monaco.editor.create(
    document.querySelector('#editor-target'),
    {
      language: 'typescript',
      minimap: { enabled: false },
      automaticLayout: true,
      theme: "github-dark",
      lineNumbers: "on",
      fontSize: 14,
      tabSize: 2,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
      },
    }
  );

  editorInstance = editor;

  const uri = monaco.Uri.parse('file:///main.ts');
  let model = monaco.editor.getModel(uri) || monaco.editor.createModel("", 'typescript', uri);

  const urlContent = loadFromUrl();
  defaultContent = `
import { Result } from "typescript-result";

class IllegalArgumentError extends Error {
  readonly type = "illegal-argument-error";
}

function divide(a: number, b: number) {
  if (b === 0) {
    return Result.error(
      new IllegalArgumentError("Division by zero is not allowed.")
    );
  }

  return Result.ok(a / b);
}

const result = divide(10, 0);
  `.trim();

  model.setValue(urlContent || defaultContent);

  editorInstance.setModel(model);

  editor.addAction({
    id: 'prettier-format',
    label: 'Save to URL',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    contextMenuGroupId: 'modification',
    run: async (editor) => {
      try {
        const position = editor.getPosition();
        const selection = editor.getSelection();
        editor.setValue(await formatCode(editor.getValue()));
        if (position) {
          editor.setPosition(position);
        }
        if (selection) {
          editor.setSelection(selection);
        }
        saveToUrl();
      } catch (error) {
        console.error('Prettier formatting failed:', error);
      }
    },
  });

  editor.addAction({
    id: 'auto-format',
    label: 'Auto Format',
    keybindings: [monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
    run: async (editor) => {
      try {
        editor.setValue(await formatCode(editor.getValue()));
      } catch (error) {
        console.error('Prettier formatting failed:', error);
      }
    },
  });
});
</script>