<script>
	import "../../../style/downloads.scss"
    import {page} from "$app/stores"
    import bytes from "bytes"
	export let data

</script>

<svelte:head>
    <title>{data.id}</title>

    <meta name="og:site_name" content={data.owner}>
    <meta name="title" content={data.filename}>
    <meta name="description" content="{bytes(data.size)} file on monofile {MONOFILE_VERSION}, the Discord-based file sharing service">
    <meta name="theme-color" content={data.embedColor}>
    <link
        rel="stylesheet"
        href="./style/downloads.scss"
    >

    <link
        rel="stylesheet"
        href="/api/v1/account/me/css"
    >

    <link
        rel="icon"
        type="image/svg"
        href="/assets/icons/file_icon.svg"
    >
    <link rel="canonical" href="{$page.url.origin}/download/{data.id}" />
    {#if data.mime.startsWith("image/")}
        {#if data.largeImage}
            <meta name="twitter:card" content="summary_large_image">
        {/if}
        <meta name="og:image" content="{$page.url.origin}/file/{data.id}"> 
    {/if}
    {#if data.mime.startsWith("video/")}
        <meta property="og:video:url" content="{$page.url.origin}/cpt/{data.id}/video.{data.mime.split("/")[1] == "quicktime" ? "mov" : data.mime.split("/")[1]}" />
        <meta property="og:video:secure_url" content="{$page.url.origin}/cpt/{data.id}/video.{data.mime.split("/")[1] == "quicktime" ? "mov" : data.mime.split("/")[1]}" />
        <meta property="og:type" content="video.other">
        <!-- honestly probably good enough for now -->
        <meta property="twitter:image" content="0">
        <!-- quick lazy fix as a fallback -->
        <!-- maybe i'll improve this later, but probably not. -->
        {#if data.size >= 26214400}
            <meta property="og:video:width" content="1280">
            <meta property="og:video:height" content="720">
        {/if}
    {/if}
</svelte:head>

<div id="appContent">
	<main>
		<h1>{data.filename}</h1>
		<p style="color:#999999">
			<span class="number">{bytes(data.size)}</span>&nbsp;&nbsp;—&nbsp;&nbsp;uploaded by <span class="number">{data.owner}</span>
		</p>

        {#if data.mime.startsWith("image/")}
            <div style="min-height:10px"></div><img src="/file/{data.id}" />
        {:else if data.mime.startsWith("video/")}
            <div style="min-height:10px"></div><video src="/file/{data.id}" controls></video>
        {:else if data.mime.startsWith("audio/")}
            <div style="min-height:10px"></div><audio src="/file/{data.id}" controls></audio>
        {/if}

		<button style="position:relative;width:100%;top:10px;">
			<a id="dlbtn" href="/api/v1/file/{data.id}" download={data.filename} style="position:absolute;left:0px;top:0px;height:100%;width:100%;"></a>
			download
		</button>
		
		<div style="min-height:15px" />
	</main>
</div>
