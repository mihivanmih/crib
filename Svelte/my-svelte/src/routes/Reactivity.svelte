<script>
    let name = "Svelte"
    let counter = 0

    $: counterClass = counter % 2 === 0 ? 'red' : 'blue'

    const changeName = () => name = "new Name"
    $: upperName = name.toUpperCase()
    $: lowerName = name.toLowerCase()

    $: {
        console.log('Name ', name)
        console.log('Counter ', counter)
    }

    $: if (counter === 6) {
        counter = 1
    }

    // first: for (let i = 0; i < 5; i++) {
    //     if (i % 2 === 0) {
    //         continue first;
    //     }
    // }

</script>

<h1>{name}</h1>
<h2>{upperName}</h2>
<h2>{lowerName}</h2>
<button on:click={changeName}>Поменять текст</button>
<h1 class={counterClass}>Counter: {counter}</h1>
<button on:click={() => counter++}>Add 1 to counter</button>
<style>
    .blue {
        color: blue;
    }
    .red {
        color: #9E0706;
    }
</style>