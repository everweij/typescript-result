---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "TypeScript Result"
  text: Supercharge your error handling
  tagline: A powerful Result type that transforms chaotic try-catch blocks into elegant, type-safe code
  image:
    src: typescript-result-logo.svg
    alt: TypeScript Result logo
    width: 150
  actions:
    - theme: brand
      text: 🚀 Getting started
      link: /getting-started
    - theme: alt
      text: Why TypeScript Result?
      link: /why


features:
  - icon: 🐞
    title: Catch bugs at compile time
    details: TypeScript's type system tracks every possible failure scenario and forces you to handle them

  - icon: 🧩
    title: Simple and tiny, yet very powerful
    details: "Thanks to the polymorphic operators, you only need to learn a few methods. And notice the small footprint: Only 1.9 KB minified and gzipped."

  - icon: ✨
    title: Full type inference without boilerplate
    details: Just return Result.ok() or Result.error() and let TypeScript do the heavy lifting

  - icon: ⚡
    title: Seamless async support
    details: Work with async operations without constant await calls through automatic AsyncResult conversion
---