<script>
    let name = "Svelte"
    let src = 'https://53news.ru/wp-content/uploads/2020/04/novgorodets-pozhalovalsya-na-soseda-kotoryj-zachem-to-derzhit-doma-gusya-2.jpg'
    let altText = 'Гусь'
    let number = 42
    let htmlText = "<strong>Гусь</strong> вот такой вот сидит"
</script>

<style>
    :global(h1) {
        color: #F39102;
        text-align: center;
    }
    img {
        width: 200px;
    }
</style>

<h1>Hello {name}</h1>
<h2>{name.toUpperCase()}</h2>
<h2>{(Math.random() * number).toFixed(0)}</h2>

<img {src} alt="{altText}">
<img {src} alt="{altText}">

<p>{@html htmlText}</p>