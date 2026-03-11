# EdgeRules Language EBNF Specification

This document provides the complete Extended Backus–Naur Form (EBNF) grammar for the EdgeRules language,
derived from the tokenizer, AST, type system, and test suite.

> **Notation:** `::=` introduces a rule; `|` separates alternatives; `( )` groups; `?` is optional (0 or 1);
> `*` repeats 0 or more times; `+` repeats 1 or more times; `"..."` is a literal; `[...]` is a character class.
> Comments are written in `(* ... *)`.

---

## Program

```ebnf
Program ::= Context | Expression
```

A program is either a single top-level `Context` object or a single `Expression`.

---

## Contexts and Statements

```ebnf
Context ::= "{" ( Statement ( Sep Statement )* Sep? )? "}"

Sep     ::= ";" | Newline
Newline ::= "\n" | "\r\n" | "\r"

Statement ::= TypeDefinition
            | FunctionDefinition
            | FieldAssignment
```

---

## Type Definitions

```ebnf
TypeDefinition ::= "type" TypeAlias ":" TypeBody

TypeBody ::= InlineTypeRef
           | TypeRef
           | TypeObject

TypeObject ::= "{" ( TypeField ( Sep TypeField )* Sep? )? "}"

TypeField ::= Identifier ":" InlineTypeRef
```

A `TypeObject` may only contain `TypeField` entries (no nested functions or value expressions).
Nested type objects are allowed: each `InlineTypeRef` may reference another `TypeAlias`.
Simple type aliasing is also supported via `TypeRef`.

---

## Type References

```ebnf
(* Used inside angle brackets, e.g. <string>, <number, 0>, <Customer[]> *)
InlineTypeRef ::= "<" TypeRef ">"
                | "<" TypeRef "," DefaultValue ">"

(* Used in parameter annotations, type aliases, and casting *)
TypeRef ::= PrimitiveType ListSuffix*
          | TypeAlias    ListSuffix*

ListSuffix ::= "[]"

PrimitiveType ::= "number" | "string" | "boolean"
                | "date" | "time" | "datetime"
                | "duration" | "period"

TypeAlias ::= [A-Z] [a-zA-Z0-9]*   (* by convention starts with uppercase *)
```

**Examples:**
```edgerules
<string>           (* inline type reference *)
<number, 0>        (* with default value *)
<Customer>         (* alias reference *)
<number[]>         (* list type *)
<string[], []>     (* list type with empty list default *)
```

---

## Default Values (inside type placeholders)

```ebnf
DefaultValue ::= NumberLiteral
               | StringLiteral
               | BooleanLiteral
               | "[" ( DefaultValue ( "," DefaultValue )* )? "]"   (* array default *)
```

---

## Function Definitions

```ebnf
FunctionDefinition ::= "func" Identifier "(" ParameterList? ")" ":" FunctionBody

FunctionBody ::= Context
               | Expression

ParameterList ::= Parameter ( "," Parameter )*

Parameter ::= Identifier ( ":" ParameterTypeAnnotation )?

ParameterTypeAnnotation ::= InlineTypeRef
                           | TypeRef
```

**Examples:**
```edgerules
func add(a, b): { result: a + b }
func getName(person: Customer): person.name
func noArgs(): { value: 42 }
func process(items: number[]): sum(items)
```

---

## Field Assignments

```ebnf
FieldAssignment ::= Identifier ":" Expression
```

The right-hand side is an `Expression`, which covers everything the language can produce: literals,
variables, function calls, contexts, collections, control-flow forms (`if/then/else`, `for/in/return`),
range expressions, arithmetic, comparison, and logical operators — including any combination thereof.

---

## Expressions

An `Expression` is anything that produces a value. The rule below enumerates every form an expression
may take. Operator precedence is a property of the language semantics and is documented in the
**Operator Precedence** table; it is not expressed through rule nesting here.

```ebnf
Expression ::= Literal
             | ContextVariable
             | FunctionCall
             | Variable
             | Context
             | Collection
             | IfThenElse
             | ForEachReturn
             | RangeExpression
             | CastExpression
             | UnaryExpression
             | PowerExpression
             | MultiplicativeExpression
             | AdditiveExpression
             | ComparisonExpression
             | AndExpression
             | XorExpression
             | OrExpression
             | FilterExpression
             | FieldAccessExpression
             | "(" Expression ")"
```

### Control Flow

```ebnf
IfThenElse    ::= "if"  Expression "then" Expression "else" Expression
ForEachReturn ::= "for" Identifier  "in"  Expression "return" Expression
```

> `else` is required in `if/then/else`.
> `for/in/return` iterates over a `Collection`, a numeric range (`a..b`), or a variable holding a list.

**Examples:**
```edgerules
if age >= 18 then "adult" else "minor"
for x in [1, 2, 3] return x * 2
for m in 1..10 return sales[m]
for item in items return item.name
```

### Range

```ebnf
RangeExpression ::= Expression ".." Expression
```

Both bounds must be integer-valued. Ranges are used as the source of a `for/in/return` loop
(`for i in 1..10 return i`) or as a filter index (`arr[1..3]`).

### Cast

```ebnf
CastExpression ::= Expression "as" TypeRef
```

Explicitly casts an expression to a specific type. If the expression is an object, fields not present in the target type are removed. Fields present in the target type but missing in the expression are set to a special value.

**Examples:**
```edgerules
{ x: 1, y: 2 } as Point
input as Customer[]
```

### Unary Operators

```ebnf
UnaryExpression ::= "-"   Expression   (* arithmetic negation *)
                  | "not" Expression   (* logical negation    *)
```

### Binary Arithmetic Operators

```ebnf
PowerExpression          ::= Expression "^"                              Expression
MultiplicativeExpression ::= Expression ( "*" | "×" | "/" | "÷" | "%" ) Expression
AdditiveExpression       ::= Expression ( "+" | "-" )                   Expression
```

### Comparison Operators

```ebnf
ComparisonExpression ::= Expression Comparator Expression

Comparator ::= "=" | "<>" | "<" | "<=" | ">" | ">="
```

### Logical Operators

```ebnf
AndExpression ::= Expression ( "and" Expression )+
XorExpression ::= Expression ( "xor" Expression )+
OrExpression  ::= Expression ( "or"  Expression )+
```

### Postfix: Filter and Field Access

```ebnf
FilterExpression      ::= Expression "[" Expression "]"   (* filter or index *)
FieldAccessExpression ::= Expression "." Identifier       (* field selection *)
```

Filter and field-access operations associate left-to-right and may be chained:
`items[active = true].name`.

---

## Function Calls

```ebnf
FunctionCall ::= QualifiedName "(" ArgumentList? ")"

QualifiedName ::= Identifier ( "." Identifier )*

ArgumentList  ::= Expression ( "," Expression )*
```

Function names may be dotted for nested access (e.g., `obj.method()`).
Built-in functions use the same call syntax as user-defined functions.

---

## Variables

```ebnf
Variable ::= QualifiedName   (* e.g. person, person.address.city *)
```

Dotted paths are resolved at link time through the context hierarchy.

---

## Context Variable

```ebnf
ContextVariable ::= "..."   (* anonymous context reference *)
                  | "it"    (* named alias for the same context reference *)
```

`...` and `it` refer to the current element being tested inside a filter predicate.

**Examples:**
```edgerules
nums[... > 5]
nums[it > 5]
items[(it > 3) and not (it > 10)]
people[name = "Alice"]          (* field name alone is resolved on the current object *)
```

---

## Collections

```ebnf
Collection ::= "[" ( Expression ( "," Expression )* )? "]"
```

> Runtime constraint: all elements must have the same type (homogeneous arrays).

**Examples:**
```edgerules
[1, 2, 3]
["a", "b", "c"]
[{a: 1}, {a: 2}]
[]
```

---

## Literals

```ebnf
Literal ::= NumberLiteral
          | StringLiteral
          | BooleanLiteral
```

### Number Literals

```ebnf
NumberLiteral ::= IntegerLiteral | FloatLiteral

IntegerLiteral ::= Digit+

FloatLiteral   ::= Digit+ "." Digit+

Digit ::= [0-9]
```

> Negative numbers are produced by the unary `-` operator applied to a positive literal,
> not by a leading minus sign in the literal itself.
> Scientific notation (`1e10`) is not supported.

### String Literals

```ebnf
StringLiteral ::= '"'  StringChar*  '"'
                | "'"  StringChar*  "'"

StringChar ::= (* any character except the enclosing quote character *)
```

> Both single and double quotes are supported.
> No escape sequences are processed; the string value is the raw content between the quotes.

### Boolean Literals

```ebnf
BooleanLiteral ::= "true" | "false"
```

---

## Identifiers

```ebnf
Identifier ::= IdentStart IdentContinue*

IdentStart    ::= [a-zA-Z]
IdentContinue ::= [a-zA-Z0-9]
                | (* Unicode Greek lowercase: U+03B1 (α) through U+03C9 (ω) *)
```

> Underscores (`_`) are **not** supported in identifiers.

---

## Comments

```ebnf
Comment ::= "//" [^\n\r]* Newline?
```

Only single-line comments are supported. Block comments are not available.

**Examples:**
```edgerules
// This is a full-line comment
value: 42   // This is an inline comment
```

---

## Keywords (Reserved Words)

The following words are reserved and cannot be used as identifiers:

| Category      | Keywords                                  |
|---------------|-------------------------------------------|
| Control flow  | `if`, `then`, `else`, `for`, `in`, `return` |
| Definitions   | `func`, `type`, `as`                      |
| Logical       | `not`, `and`, `or`, `xor`                |
| Boolean       | `true`, `false`                           |
| Primitive types | `number`, `string`, `boolean`, `date`, `time`, `datetime`, `duration`, `period` |

---

## Operator Precedence Summary

From **lowest** (outermost) to **highest** (innermost):

| Precedence | Operator(s)              | Associativity |
|------------|--------------------------|---------------|
| 1 (lowest) | `if/then/else`, `for/in/return` | —         |
| 2          | `..` (range)             | left          |
| 3          | `or`                     | left          |
| 4          | `xor`                    | left          |
| 5          | `and`                    | left          |
| 6          | `not`                    | right (unary) |
| 7          | `=` `<>` `<` `<=` `>` `>=` | left (non-associative) |
| 8          | `+` `-`                  | left          |
| 9          | `*` `×` `/` `÷` `%`      | left          |
| 10         | `^`                      | left          |
| 11         | unary `-`                | right         |
| 12         | `as`                     | left          |
| 13         | `[...]` (filter/index), `.` (selection) | left |
| 14 (highest) | `()` (function call)   | left          |

---

## Special Values

Special values are produced by the runtime (not written as literals in source code):

| Value            | Meaning                                          |
|------------------|--------------------------------------------------|
| `Missing`        | Expected value was absent or not provided        |
| `NotApplicable`  | Value is not relevant; treated as neutral (0/1/"") in arithmetic |
| `Invalid`        | Value failed a type-cast validation              |
| `NotFound`       | Referenced field or index does not exist (treated as `Missing`) |

Built-in predicates for testing special values: `isMissing(x)`, `isNotApplicable(x)`,
`isInvalid(x)`, `isSpecialValue(x)`, `isPresent(x)`.

> Special values propagate through operations: any arithmetic on `Missing` yields `Missing`.
> `NotApplicable` acts as 0 in addition/subtraction and 1 in multiplication/division,
> and as `""` in string concatenation.

---

## Type Arithmetic

Summary of valid arithmetic and comparison operations by type:

### Arithmetic

```
number ± number            → number
number × / % ^ number      → number
string + string            → string
date + duration            → datetime
datetime + duration        → datetime
time + duration            → time
date + period              → date
datetime + period          → datetime
date - date                → duration
datetime - datetime        → duration
time - time                → duration
date - duration            → datetime
datetime - duration        → datetime
time - duration            → time
duration ± duration        → duration
period ± period            → period
```

### Comparison

```
number   = <> < <= > >=  number    → boolean
string   = <>            string    → boolean
boolean  = <>            boolean   → boolean
date     = <> < <= > >=  date      → boolean
date     = <> < <= > >=  datetime  → boolean  (* date treated as midnight datetime *)
datetime = <> < <= > >=  datetime  → boolean
time     = <> < <= > >=  time      → boolean
duration = <> < <= > >=  duration  → boolean
period   = <>            period    → boolean  (* no ordering for period *)
```

---

## Date and Time

Date, time, datetime, duration, and period values are created with built-in constructor functions:

```ebnf
DateLiteral     ::= "date"     "(" StringLiteral ")"
TimeLiteral     ::= "time"     "(" StringLiteral ")"
DatetimeLiteral ::= "datetime" "(" StringLiteral ")"
DurationLiteral ::= "duration" "(" StringLiteral ")"
PeriodLiteral   ::= "period"   "(" StringLiteral ")"
```

String formats:

| Type       | Format                            | Examples                       |
|------------|-----------------------------------|--------------------------------|
| `date`     | `YYYY-MM-DD`                      | `"2024-01-15"`                 |
| `time`     | `HH:MM:SS`                        | `"14:30:00"`                   |
| `datetime` | `YYYY-MM-DDTHH:MM:SS[.sss][Z\|±HH:MM]` | `"2024-01-15T14:30:00Z"` |
| `duration` | `P[nD][T[nH][nM][nS]]`            | `"P4D"`, `"PT90M"`, `"P2DT3H"` |
| `period`   | `P[nY][nM][nD]`                   | `"P18Y6M"`, `"P1Y"`, `"P10D"` |

Component access uses dot notation: `date("2024-01-15").year`, `datetime(...).hour`, `duration(...).totalHours`.

---

## Complete Grammar in One Block

```ebnf
(* ============================================================
   EdgeRules Language — Complete EBNF
   ============================================================ *)

(* --- Top level --- *)

Program ::= Context | Expression

Context ::= "{" ( Statement ( Sep Statement )* Sep? )? "}"

Sep     ::= ";" | Newline
Newline ::= "\n" | "\r\n" | "\r"

Comment ::= "//" [^\n\r]* Newline?

Statement ::= TypeDefinition
            | FunctionDefinition
            | FieldAssignment

(* --- Type definitions --- *)

TypeDefinition ::= "type" TypeAlias ":" TypeBody

TypeBody ::= InlineTypeRef
           | TypeRef
           | TypeObject

TypeObject ::= "{" ( TypeField ( Sep TypeField )* Sep? )? "}"

TypeField ::= Identifier ":" InlineTypeRef

(* --- Type references --- *)

InlineTypeRef ::= "<" TypeRef ">"
                | "<" TypeRef "," DefaultValue ">"

TypeRef ::= PrimitiveType ListSuffix*
          | TypeAlias    ListSuffix*

ListSuffix ::= "[]"

PrimitiveType ::= "number" | "string" | "boolean"
                | "date" | "time" | "datetime"
                | "duration" | "period"

TypeAlias ::= [A-Z] [a-zA-Z0-9]*

(* --- Function definitions --- *)

FunctionDefinition ::= "func" Identifier "(" ParameterList? ")" ":" FunctionBody

FunctionBody ::= Context | Expression

ParameterList ::= Parameter ( "," Parameter )*

Parameter ::= Identifier ( ":" ParameterTypeAnnotation )?

ParameterTypeAnnotation ::= InlineTypeRef | TypeRef

(* --- Field assignment --- *)

FieldAssignment ::= Identifier ":" Expression

(* --- Expressions ---
   An Expression is anything that produces a value.
   Operator precedence is a language property; see the Operator Precedence table. *)

Expression ::= Literal
             | ContextVariable
             | FunctionCall
             | Variable
             | Context
             | Collection
             | IfThenElse
             | ForEachReturn
             | RangeExpression
             | CastExpression
             | UnaryExpression
             | PowerExpression
             | MultiplicativeExpression
             | AdditiveExpression
             | ComparisonExpression
             | AndExpression
             | XorExpression
             | OrExpression
             | FilterExpression
             | FieldAccessExpression
             | "(" Expression ")"

(* Control flow *)

IfThenElse    ::= "if"  Expression "then" Expression "else" Expression
ForEachReturn ::= "for" Identifier  "in"  Expression "return" Expression

(* Range *)

RangeExpression ::= Expression ".." Expression

(* Cast *)

CastExpression ::= Expression "as" TypeRef

(* Unary operators *)

UnaryExpression ::= "-"   Expression
                  | "not" Expression

(* Binary arithmetic *)

PowerExpression          ::= Expression "^"                              Expression
MultiplicativeExpression ::= Expression ( "*" | "×" | "/" | "÷" | "%" ) Expression
AdditiveExpression       ::= Expression ( "+" | "-" )                   Expression

(* Comparison *)

ComparisonExpression ::= Expression Comparator Expression

Comparator ::= "=" | "<>" | "<" | "<=" | ">" | ">="

(* Logical *)

AndExpression ::= Expression ( "and" Expression )+
XorExpression ::= Expression ( "xor" Expression )+
OrExpression  ::= Expression ( "or"  Expression )+

(* Postfix: filter / field access *)

FilterExpression      ::= Expression "[" Expression "]"
FieldAccessExpression ::= Expression "." Identifier

(* --- Function calls --- *)

FunctionCall ::= QualifiedName "(" ArgumentList? ")"

QualifiedName ::= Identifier ( "." Identifier )*

ArgumentList ::= Expression ( "," Expression )*

(* --- Variable --- *)

Variable ::= QualifiedName

(* --- Context variable --- *)

ContextVariable ::= "..." | "it"

(* --- Collections --- *)

Collection ::= "[" ( Expression ( "," Expression )* )? "]"

(* --- Literals --- *)

Literal ::= NumberLiteral | StringLiteral | BooleanLiteral

NumberLiteral ::= IntegerLiteral | FloatLiteral

IntegerLiteral ::= Digit+
FloatLiteral   ::= Digit+ "." Digit+
Digit          ::= [0-9]

StringLiteral ::= '"' [^"]* '"'
                | "'" [^']* "'"

BooleanLiteral ::= "true" | "false"

(* --- Default values (inside inline type references) --- *)

DefaultValue ::= NumberLiteral
               | StringLiteral
               | BooleanLiteral
               | "[" ( DefaultValue ( "," DefaultValue )* )? "]"

(* --- Identifiers --- *)

Identifier ::= [a-zA-Z] ( [a-zA-Z0-9] | (* U+03B1-U+03C9 Greek lowercase *) )*
```

---

## Full Example

```edgerules
{
    // Type definitions
    type Customer: { name: <string>; birthdate: <date>; income: <number, 0> }
    type Applicant: { customer: <Customer>; requestedAmount: <number> }

    // Inputs (typed placeholders — value provided externally)
    executionDatetime: <datetime>

    // Decision function
    func calculateLoanOffer(applicant: Applicant): {
        eligible: if applicant.customer.birthdate + period("P18Y") <= executionDatetime
                  then true
                  else false
        interestRate: if applicant.customer.income > 5000 then 0.05 else 0.1
        result: {
            eligible: eligible
            amount: applicant.requestedAmount
        }
    }

    // Sample input
    applicant1: {
        customer: { name: "Alice"; birthdate: date("2001-01-01"); income: 6000 }
        requestedAmount: 20000
    }

    // Call the function and use the result
    offer: calculateLoanOffer(applicant1).result

    // Collection operations
    sales: [10, 20, 8, 7, 1, 10, 6, 78, 0, 8, 0, 8]
    topSales: sales[... > 50]
    doubled: for n in sales return n * 2
    best: max(sales)
}
```

---

## Output EBNF

The following grammar describes the structure of the values produced as the output of an EdgeRules program. It is a strict subset of the full language grammar, excluding all definitions, operators, and control-flow expressions. To avoid ambiguity with the source grammar, these rules use the `Output` prefix.

```ebnf
Output ::= OutputValue

OutputValue ::= Literal
              | OutputCollection
              | OutputContext
              | TemporalValue
              | SpecialValue

OutputCollection ::= "[" ( OutputValue ( "," OutputValue )* )? "]"

OutputContext ::= "{" ( OutputFieldAssignment ( Sep OutputFieldAssignment )* Sep? )? "}"

OutputFieldAssignment ::= Identifier ":" OutputValue

Literal ::= NumberLiteral
          | StringLiteral
          | BooleanLiteral

TemporalValue ::= "date"     "(" StringLiteral ")"
                | "time"     "(" StringLiteral ")"
                | "datetime" "(" StringLiteral ")"
                | "duration" "(" StringLiteral ")"
                | "period"   "(" StringLiteral ")"

SpecialValue ::= "Missing" "(" StringLiteral ")"
               | "NotApplicable"
               | "Invalid" "(" StringLiteral ")"
               | "NotFound"
```