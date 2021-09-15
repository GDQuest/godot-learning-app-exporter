# GDQuest Godot Learning App Exporter

In order to use a project in a lesson with the GDScript Live Editor, a project must be prepared.

This small utility with 0 dependencies builds the required configuration file.

You will need Node to run the utility.

### Usage

```sh
npx godot-learning-app-exporter path/to/godot/project
```

`path/to/godot/project` is the directory where a `project.godot` file can be found.

This command will output JSON with the proper configuration to STDOUT.
Pipe it/redirect it to the tool of your choice

If you don't like redirection, just use --output:

```sh
npx godot-learning-app-exporter path/to/godot/project -o config.json
```

### FLAGS:

- -h --help          this help text
- -o --output [file] save to file
