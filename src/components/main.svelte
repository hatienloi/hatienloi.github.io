<script context="module">
    import Device from 'svelte-device-info'
</script>
<script>
    let src = "/HaTienLoi-CV.pdf";

    $: if (Device.isPhone || Device.isMobile || Device.isTablet) {
        window.location.href = src;
    }
</script>

<embed class="main" {src} type="application/pdf"/>

<style scoped>
    .main {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
    }
</style>
