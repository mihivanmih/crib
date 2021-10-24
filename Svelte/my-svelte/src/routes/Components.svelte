<script>
    import Person from "../components/Person.svelte";
    let people = [
        { id: 1, name: 'Максим', age: 24, job: 'Frontend' },
        { id: 2, name: 'Елена', age: 17, job: 'Student' }
    ]

    let name = 'Igor'
    let age = 20
    let job = 'Backend'

</script>

<h1>Application</h1>

<Person
        name={people[0].name}
        age={people[0].age}
        job={people[0].job}
/>

<Person {...people[1]} />
<Person {name} {age} {job} />