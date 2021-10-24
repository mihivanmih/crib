<script>
    let name = "Svelte"
    let agree = false
    let text = ""
    let select = "1"
    let sex = "Male"

    function bindName(event) {
        name = event.target.value
    }

</script>

<h1>{name}</h1>
<!--<input type="text" value="{name}" on:input={bindName}>-->
<input type="text" bind:value={name}>
<hr>
<input type="checkbox" bind:checked={agree}> {agree}
<hr>
<textarea name="" id="" cols="30" rows="10" bind:value={text} />
<div style="white-space: pre-wrap">{text}</div>
<hr>
<select bind:value={select}>
    <option value="0">Option 0</option>
    <option value="1">Option 1</option>
    <option value="2">Option 2</option>
</select>
<hr>
<input type="radio" value="female" bind:group={sex} > Female
<input type="radio" value="male" bind:group={sex} > Male
<br>
Sex: {sex}