<script>
    import "../style/error.scss"
    import { page } from "$app/stores"
</script>

<svelte:head>
    <link rel="icon" type="image/svg" href="/assets/icons/error.svg" />
    <link rel="stylesheet" href="/api/v1/account/me/css" />
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, user-scalable=0"
    />
    <title>{$page.status}</title>
    <meta name="theme-color" content="rgb(30, 33, 36)" />
</svelte:head>
<p class="error">
    <span class="code">{$page.status}</span>
    &nbsp;{$page.error.message}
</p>
