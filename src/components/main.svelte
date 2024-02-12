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

    * {
        &::-webkit-scrollbar-track {
            -webkit-box-shadow: inset 0 0 6px #DFE4E8;
        }

        &::-webkit-scrollbar {
            width: 7px !important;
            border-radius: 5px !important;
            background-color: #DFE4E8;
        }

        &::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.52);
            border-radius: 5px !important;
        }
    }
</style>
