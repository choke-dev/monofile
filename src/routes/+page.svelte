<script lang="ts">
    import { onMount } from "svelte"
    import Topbar from "./components/Topbar.svelte"
    import PulldownManager from "./components/PulldownManager.svelte"
    import UploadWindow from "./components/UploadWindow.svelte"
    import { pulldownManager } from "./components/stores.js"
    import "../style/app.scss"
    let topbar: Topbar

    let pulldown: PulldownManager

    onMount(() => {
        pulldownManager.set(pulldown)
    })
</script>

<svelte:head>
    <title>monofile</title>

    <meta name="title" content="monofile" />
    <meta
        name="description"
        content="The open-source Discord-based file sharing service"
    />
    <meta name="theme-color" content="rgb(30, 33, 36)" />
</svelte:head>

<Topbar bind:this={topbar} {pulldown} />
<div id="appContent">
    <PulldownManager bind:this={pulldown} />

    <UploadWindow />
</div>
