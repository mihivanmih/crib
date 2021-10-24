<script>
    let value = "Hello"

    $: error = !isValid(value)

    function isValid(val) {
        return val.length >= 5 && val.length < 10;
    }

</script>

<h1>Application</h1>

<input type="text" bind:value class:red={error} class:green={!error}>

{#if value.length < 5}
    <p>Длинна меньше 5 символов</p>
{:else if value.length > 10}
    <p>Длинна больше 10 символов</p>
{:else}
    <p>Длинна между 5 и 10</p>
{/if}

<style>
    input {
        outline: none;
    }
    .red {
        border-color: #9E0706;
    }

    .green {
        border-color: #84fab0;
    }
</style>