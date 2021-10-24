<script>
    export let name = 'Undefined name'
    export let age = 'Undefined age'
    export let job = 'Undefined job'
    export let index = '1'

   let copy = name
</script>

<style>
    div {
        border: 1px solid black;
        padding: 1rem;
        margin-bottom: 1rem;
    }
</style>

<div>
    <p>№ {index+1}</p>
    <p>Имя: <strong>{name}</strong> / {copy}</p>
    <p>Занятие: <strong>{job}</strong></p>

    {#if age < 18}
        <p>Пиво продавать нельзя</p>
    {:else}
        <p>Делай что хочешь</p>
    {/if}

</div>