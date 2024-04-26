<script context="module">
    import Device from 'svelte-device-info'
</script>
<script>
    let src = "/HaTienLoi-CV.pdf";

    $: if (Device.isPhone || Device.isMobile || Device.isTablet) {
        window.location.href = src;
    }
</script>

<embed class="absolute w-full h-full inset-0" {src} type="application/pdf"/>
