fetch("activities/demo-science-7-1.json")

.then(response => response.json())

.then(activity => {

    document.getElementById("activityTitle").textContent = activity.title;

    document.getElementById("activityInfo").textContent =
        activity.subject +
        " • " +
        activity.yearLevel +
        " • " +
        activity.topic;

})

.catch(error => {

    console.error(error);

});
