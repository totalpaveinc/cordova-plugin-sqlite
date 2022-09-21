Cordova SQLite Plugin Documentation
===================================

This document describes the public API available to library consumers.

This plugin does not aim to be a direct API to SQLite, instead it mimicks the Breautek's [Storm](https://github.com/breautek/storm) database API.
# Table of Contents
- [1.0 - Plugin Namespace](#10---plugin-namespace)
- [1.1 - Undefined Behaviour](#11---undefined-behaviour)
- [2.0 - SQLite](#20---sqlite)
  - [2.1 - Thread Safety](#21---thread-safety)
  - [2.2 - open](#22---open)
  - [2.3 - close](#23---close)
- [3.0 - Database](#30---database)
  - [3.1 - getHandle](#31---gethandle)
  - [3.2 - isClosed](#32---isclosed)
- [4.0 - Query](#40---query)
  - [4.1 - TParamsObject](#41-tparamsobject)
  - [4.2 - Constructor](#42-constructor)
  - [4.3 - getQuery](#43-getquery)
  - [4.4 - execute](#44-execute)
- [5.0 - ParamBuilder](#50-parambuilder)
  - [5.1 - constructor](#51-constructor)
  - [5.2 - setNumber](#52---setnumber)
  - [5.3 - setBoolean](#53---setboolean)
  - [5.4 - setString](#54---setstring)
  - [5.5 - setArrayBuffer](#55---setarraybuffer)
  - [5.6 - setBytes](#56---setbytes)
  - [5.7 - setBlob](#57---setblob)
  - [5.8 - build](#58---build)
  

## 1.0 - Plugin Namespace

This plugin is namespaced under `window.totalpave.sqlite` and for brevity this will be omitted throughout the remainder of this document. For example, the `SQLite` package is located at `window.totalpave.sqlite.SQLite` but will be only referenced as `SQLite`.

## 1.1 - Undefined Behaviour

A note on undefined behaviour for those who are unfamiliar with the term. [Undefined behaviour](https://en.cppreference.com/w/cpp/language/ub) is a term often used in C++ that signals a procedure that is illogical, or may produce machine code that may work or may not work, and the actual result of the code is not determined by looking at the source code. That is, the program may work, it may produce a no-operation, it may corrupt data, it may fatally crash. The behaviour is undefined and anything _could_ happen, therefore anything that is known to create undefined behaviour should be avoided.

## 2.0 - SQLite

A static class for opening and closing databases.

### 2.1 - Thread Safety

A note on thread safety. Generally speaking, SQLite is not thread-safe. It is dangerous to have 2 independent write connections to the same database. This plugin makes no effort to ensure thread safety, but the underlying SQLite library is built with some level of threading support. Care has been taken to ensure that, at least witin totalpave provided packages, that only a single copy of the SQLite and libc++ libraries will be used to avoid database corruption issues.

Generally speaking, SQLite is used on local clients and it's presumed that the application will only have a single connection to the database.

### 2.2 - open

Opens a new connection the database at __path__. By default, the connection will be readonly and will error if the database does not already exists. If __writeAccess__ is `true`, then the database will be opened with write mode enabled, and if the database file does not exists, it will be created.

The returned value is a [Database](#Database). It represents the underlying database handle. Keep a reference to this value for preparing SQL statements and for closing the database later.

##### Signature

```typescript
static async open(path: string, writeAccess: boolean): Promise<number>;
```

### 2.3 - close

Closes an opened database. Use this to free resources allocated in the native environment. Using a closed database will result in undefined behaviour.

##### Signature

```typescript
static async close(db: Database): Promise<void>;
```

## 3.0 - Database

A class that represents a database handle. By itself, it's not very useful, but a reference is required for executing SQL statements and closing the database when no longer in use.

### 3.1 - getHandle

Returns a number that represents the memory address of the underlying database handle.

##### Signature

```typescript
getHandle(): number;
```

### 3.2 - isClosed

Returns true if the database is closed. When a database is closed, it is unsafe to use it for SQL queries. Executing SQL queries on a closed database is undefined behaviour.

##### Signature

```typescript
isClosed(): boolean;
```

## 4.0 - Query

Query is an `abstract class` that represents an SQL statement. It is not usable on it's own and is intended to be subclassed. The design rationale behind this is it allows you to extract SQL strings out of the application and for it to be shared across the application, libraries, or even unit tests.

The `Query` class has two generic types: `TParams` and `TResponse`.

`TParams` should be an interface that describes a JSON params object. It must adhere to the [TParamsObject](#41-tparamsobject) type.

Classes that extends `Query` must implement the following methods:

- [getQuery](#43-getquery)

Named parameters can be provided in the SQL query which are populated by the `TParamsObject` properties. Named parameters are binded using SQLite's binding APIs and therefore are safely escaped.

Note that the `TResponse` generic type is provided to assert developer intent. It does not guarentee that the underlying returned data is actually the declared type. However, if there is a mismatch, it is likely either an error in the typing or in the actual SQL query statement.

### 4.1 TParamsObject

The `TParamsObject` is an object that can hold the following structure:

```typescript
interface TParamsObject {
    [key: string]: string | number | IByteArray;
}
```

The JSON object can have any number of properties consisting of `string`, `number`, or `IByteArray` types.

`IByteArray` is a special structure not intended to be crafted manually. Use [ParamBuilder]() to build a `TParamsObject` that contains byte arrays or other binary blob data.

### 4.2 Constructor

Constructs a new instance of `Query` with the given [TParamsObject](#41-tparamsobject).

Subclasses may declare that `TParamsObject` is `void`, that is it accepts no parameters.

##### Signature

```typescript
constructor(params: TParams);
```


### 4.3 getQuery

Returns the SQL query as a string. It may have named variables, denoted by a keyword prefixed with the colon (`:`) character.

Example:

```sql
INSERT INTO person (firstName, lastName)
VALUES (:firstName, :lastName)
```

##### Signature

```typescript
abstract getQuery(): string;
```

### 4.4 execute

Executes the `Query` onto the given [Database](#30---database). The database must not be closed or undefined behaviour will occur. Query parameters are passed through.

Each `execute` statement internally prepares a new SQLite statement context and act independent of a previous `execute` call. Therefore, the same `Query` instance can be execute multiple times, which can be useful for select statements for refreshing data, for example.

The return type is the generic type `TResponse`. The return type is not known at the abstract level, but is generally `void` for any query that is not a `SELECT` query.

For `SELECT` queries, the return type is generally an array of json objects, whose properties are keyed by the select query columns.

##### Signature

```typescript
async execute(db: Database): Promise<TResponse>;
```


## 5.0 ParamBuilder

ParamBuilder is a class for constructing more complex parameters for a [Query](#40---query).

Generally speaking, it will be easier/faster to construct a standard JSON object if your parameters consists of only `number`, and `string` types. However, if you require to bind `boolean` or `Blob`, then `ParamBuilder` may be beneficial to use.

Note that `ParamBuilder` requires to be ran in an async context, as `Blob` APIs are asynchronous.

Each setter method returns an instance of hte `ParamBuilder` allowing you to chain calls.

For example:

```typescript
let builder: ParamBuilder = new ParamBuilder();
let params: TParamsObject = await builder.setNumber('height', 5.7)
    .setBoolean('prettyFly', true)
    .setString('name', 'John Smith')
    .build();
```

### 5.1 Constructor

A simple constructor that accepts no parameters.

##### Signature

```typescript
constructor();
```

### 5.2 - setNumber

Sets a number value at the given `key`. Number will either be treated as an `int` (16 bit) or a `double`, depending on the column type of the SQLite table.

##### Signature

```typescript
setNumber(key: string, value: number): ParamBuilder
```

### 5.3 - setBoolean

Sets a boolean at the given `key`. SQLite does not support booleans, so this method will convert the boolean to `1` for true and `0` for false.

##### Signature

```typescript
setBoolean(key: string, value: boolean): ParamBuilder
```

### 5.4 - setString

Sets a string at the given `key`. Strings must be UTF-8.
JavaScript UTF-16 strings are converted to UTF-8.

##### Signature

```typescript
setString(key: string, value: string): ParamBuilder
```

### 5.5 - setArrayBuffer

Sets a binary blob provided by the given `ArrayBuffer` at the given `key`. As blobs cannot be sent over the bridge, this creates an internal structure to signal the native that the dataset represents a blob and thus should use SQLite's blob binding method.

##### Signature

```typescript
setArrayBuffer(key: string, value: ArrayBuffer): ParamBuilder
```

### 5.6 - setBytes

Sets a binary blob provided by the given `Uint8Array` at the given `key`. As blobs cannot be sent over the bridge, this creates an internal structure to signal the native that the dataset represents a blob and thus should use SQLite's blob binding method.

##### Signature

```typescript
setBytes(key: string, value: Uint8Array): ParamBuilder
```

### 5.7 - setBlob

Sets a binary blob at the given `key`. As blobs cannot be sent over the bridge, this creates an internal structure to signal the native that the dataset represents a blob and thus should use SQLite's blob binding method.

##### Signature

```typescript
setBlob(key: string, value: Blob): ParamBuilder
```

### 5.8 - build

Builds a [TParamsObject](#41-tparamsobject) to be used by a [Query](#40---query).

Due to some data types that requires the use of asynchronous APIs, this method is also asynchronous.

This method can be called several times. A new object is created and returned for each `build` call.

##### Signature

```typescript
async build(): Promise<TParamsObject>;
```

## 6.0 RawQuery

A prebuilt [Query](#40---query) that accepts both the SQL string and the associated [TParamsObject](#41-tparamsobject).

It can be used to perform an SQL query without building out a class that extends the `Query` class. Useful for quickly debugging things or for unit tests.

It's not recommended to use this class in production and instead to extend and use your own `Query` implementations, where you can declare typings as well as build unit tests around.

The `RawQuery` exposes the `Query` generics, but by default it is permissive and can be used without declaring types.

### 6.1 constructor

The consructor consists of the standard `TParamsObject` as well as the SQL statement.

The params object may be omitted if the SQL statement contains no named parameters.

##### Signature

```typescript
constructor(sql: string, params?: TParams);
```
