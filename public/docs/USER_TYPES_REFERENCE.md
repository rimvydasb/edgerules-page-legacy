# User Defined Types Reference

## Simple Types

User can define their own types and use them for function variables.

```edgerules
{
    type NumList: <number[]>
    func inc(nums: NumList): {
        result: for n in nums return n + 1
    }
    vals: inc([1, 2, 3]).result
}
```

**output:**
```json
{
  "vals": [
    2,
    3,
    4
  ]
}
```

## Complex Types

Types can be nested and combined.

```edgerules
{
    type Person: { 
        name: <string>; age: <number>; tags: <string[]> 
    }
    type PeopleList: <Person[]>
    func getAdults(people: PeopleList): {
        result: people[age >= 18]
    }
    adults: getAdults([
        {name: "Alice"; age: 30; tags: ["engineer", "manager"]}
        {name: "Bob"; age: 15; tags: ["student"]}
        {name: "Charlie"; age: 22; tags: ["designer"]}
    ])
}
```

**output:**
```json
{
  "adults": {
    "result": [
      {
        "name": "Alice",
        "age": 30,
        "tags": [
          "engineer",
          "manager"
        ]
      },
      {
        "name": "Charlie",
        "age": 22,
        "tags": [
          "designer"
        ]
      }
    ]
  }
}
```

## Argument Casting

At runtime, complex objects are cast to the expected type when passed as function arguments.
Casting is fault-tolerant and works in this way: fields that do not exist in the object definition are filtered out,
and fields that exist in the definition, but not in the object, are set to Special Value.
This approach brings predictable behavior and is fault-tolerant with unexpected data in production.

```edgerules
{
    type Person: { 
        name: <string>; age: <number>; tags: <string[]> 
    }
    func checkPerson(person: Person): {
        checkedPerson: person
        isStudent: contains(person.tags, "student")
        isAdult: person.age >= 18
    }
    result: checkPerson({
        name: "Alice";
        tags: ["manager"]
    })
}
```

**output:**
```json
{
  "result": {
    "checkedPerson": {
      "name": "Alice",
      "age": "Missing('age')",
      "tags": [
        "manager"
      ]
    },
    "isStudent": false,
    "isAdult": false
  }
}
```

## Explicit Casting

During runtime, complex objects can be explicitly cast to the expected type using the `as` operator.
Behavior is the same as with argument casting: fields that do not exist in the object definition are filtered out.
And fields that exist in the definition, but not in the object, are set to Special Value.
Use explicit casting when you want to ensure that the object conforms to the expected type.
This method is fault-tolerant and will not throw errors on missing or extra fields.
Casting will not convert field types - if the field type does not match the expected type, the execution will be terminated.

```edgerules
{
    type Point: { x: <number>; y: <number> }
    p: { x: 1 } as Point
}
```

**output:**
```json
{
  "p": {
    "x": 1,
    "y": "Missing('y')"
  }
}
```