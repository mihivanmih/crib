<script>
    import Person from "../components/Person.svelte";
    let people = [
        { id: 1, name: 'Максим', age: 24, job: 'Frontend' },
        { id: 2, name: 'Елена', age: 17, job: 'Student' }
    ]
    let value = ""
    let age = ""
    let job = ""

    function removeFirst() {
        people = people.slice(1)
    }

    function addPerson() {
/*        people = people.concat([{
            id: Date.now,
            name: value
        }])*/

        people = [...people, {
            id: Math.random(),
            name: value,
            age: age,
            job: job
        }]

        value = age = job = ""

        console.log("people", people)

    }

</script>

<h1>Циклы</h1>

<input type="text" bind:value placeholder="Имя">
<input type="text" bind:value={age} placeholder="Возраст">
<input type="text" bind:value={job} placeholder="Job">
<button on:click={addPerson}>Добавить человека</button>
<button on:click={removeFirst}>Удалить первого человека</button>
<hr>

{#each people as {name, age, job, id}, i (id)}
   <!-- <Person name={person.name} age={person.age} job={person.job} index={i} />-->
    <Person {name} {age} {job} index={i} />
{:else}
    <p>Людей не осталось</p>
{/each}


