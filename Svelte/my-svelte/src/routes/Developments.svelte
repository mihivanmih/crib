<script>
    let name = "Текст который изменится"
    const changeNameHandler = () =>  name = "Текст поменялся"
    let pos = {
        x: 0,
        y: 0
    }
    const mouseMoveHandler = event => {
        pos.x = event.x
        pos.y = event.y
    }
    let inputValue = ""
    const submitHandler = (event) => console.log(inputValue)
</script>

<h1>{name}</h1>
<button on:click={changeNameHandler}>Поменять текст</button>
<div class="playground" on:mousemove={mouseMoveHandler}>X:{pos.x} Y:{pos.y}</div>

<form action="" on:submit|preventDefault|once={submitHandler}>
    <input type="text" on:input={event => (inputValue = event.target.value)}>
    <button type="submit">Отправить форму</button>
</form>

<style>
    .playground {
        width: 400px;
        height: 200px;
        padding: 1rem;
        margin-bottom: 1rem;
        border: 1px solid black;
    }
</style>