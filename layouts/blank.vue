<template>
    <slot />
</template>
<style lang="scss">
body,
html {
    padding-right: 0px !important;
    height: initial !important;
    width: 100%;
    overflow-x: hidden;
    font-family: 'Noto Sans TC', 'Helvetica Neue', Helvetica, sans-serif;
    text-align: center;
    font-size: 15px;
    min-height: 100vh;
    position: relative;
    margin: 0;
}

* {
    box-sizing: border-box;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0);
}
</style>
