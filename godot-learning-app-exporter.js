#!/usr/bin/env node
//@ts-check
/**
 * Godot Learning App Exporter
 *
 * ### Usage
 *
 * <this file name> path/to/godot/project
 *
 * `path/to/godot/project` is the directory where a `project.godot` file can be
 * found.
 *
 * This command will output JSON with the proper configuration to STDOUT.
 * Pipe it/redirect it to the tool of your choice
 *
 * If you don't like redirection, just use --output:
 *
 * <this file name> path/to/godot/project -o config.json
 *
 * ### FLAGS:
 *
 * -h --help          this help text
 * -o --output [file] save to file
 */
const {
  readdirSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} = require("fs");
const { extname, join, resolve, basename, dirname } = require("path");

const cwd = process.cwd();

const glob = (dirPath = cwd, extension = ".gd") =>
  readdirSync(dirPath)
    .map((file) => join(dirPath, file))
    .reduce(
      (arr, path) =>
        statSync(path).isDirectory()
          ? arr.concat(glob(path))
          : extname(path).toLowerCase() === extension
          ? (arr.push(path), arr)
          : arr,
      []
    );

const tagRegExp = /^(\s*)#\s(EXPORT)(?:(?:\s+)(.*?))?(?:\s|$)/;

const sanitizeFileContents = (fileContents = "") =>
  fileContents
    .replace(/\r\n|\r/g, "\n")
    .replace(/^(  +)/g, (subs) => "\t".repeat(subs.length));

const getProjectSlices = (projectPath = cwd) =>
  glob(projectPath, ".gd")
    .reduce((validFiles, path) => {
      const filePath = path.replace(projectPath, "");
      const contents = sanitizeFileContents(readFileSync(path, "utf-8"));
      const lines = contents.split(`\n`);
      const validSlices = lines.reduce((validLines, line, lineNb) => {
        const [, indentStr, keyword, name] = line.match(tagRegExp) || [];

        if (!keyword) {
          return validLines;
        }

        const indent = indentStr.length;
        const slice = {
          all: true,
          name: "",
          before: "",
          after: "",
          contents,
          indent,
          start: lineNb,
          end: lines.length,
        };

        if (!name || name === "*") {
          slice.name = "*";
          slice.contents = (
            indent ? lines.map((line) => line.slice(indent)) : lines.slice()
          ).join("\n");
          validLines.push(slice);
          return validLines;
        }
        const start = lineNb + 1;
        const endRegExp = RegExp(
          "^" + indentStr + "# \\/" + keyword + " " + name + "\\s*$"
        );
        const _end = lines
          .slice(start)
          .findIndex((line) => line.match(endRegExp));
        if (_end === -1) {
          throw new Error(
            `${filePath}: The slice "${name}" does not have a closing tag`
          );
        }
        const end = start + _end;
        const original = lines.slice(start, end);
        slice.all = false;
        slice.name = name;
        slice.end = end;
        slice.start = start + 1;
        slice.before = lines.slice(0, start + 1).join("\n");
        slice.after = lines.slice(end + 1).join("\n");
        slice.original = original.join("\n");
        slice.contents = (
          indent ? original.map((line) => line.slice(indent)) : original.slice()
        ).join("\n");
        validLines.push(slice);

        return validLines;
      }, []);
      if (!validSlices.length) {
        return validFiles;
      }
      const file_name = basename(filePath, extname(filePath));
      const dir_name = dirname(filePath);
      const godot_path = `res://${filePath}`;
      const { slices, slices_names } = validSlices.reduce(
        (obj, slice) => {
          obj.slices[slice.name] = slice;
          obj.slices_names.push(slice.name);
          return obj;
        },
        { slices: {}, slices_names: [] }
      );
      validFiles.push({
        file_path: filePath,
        dir_name,
        file_name,
        godot_path,
        slices_names,
        slices,
      });
      return validFiles;
    }, [])
    .reduce(
      (obj, fileConfig) => {
        obj.files[fileConfig.file_path] = fileConfig;
        obj.files_paths.push(fileConfig.file_path);
        return obj;
      },
      { files_paths: [], files: {} }
    );

if (require.main === module) {
  const error = (message = "") => {
    console.error(message);
    process.exit(1);
  };

  const getProjectPath = (path = cwd) => {
    const projectPath = resolve(cwd, path) + "/";

    if (!existsSync(projectPath)) {
      error(
        `"${projectPath}" doesn't exist or isn't accessible. Please check your path`
      );
    }

    const projectFilePath = join(projectPath, "project.godot");

    if (!existsSync(projectFilePath)) {
      error(
        `No "project.godot" file found in "${projectPath}". Are you sure this is a Godot repository?`
      );
    }

    return projectPath;
  };

  const [, , arg, save, providedSavePath] = process.argv;

  if (arg === "-h" || arg === "--help") {
    const text = (readFileSync(__filename, "utf-8").match(
      /\n\/\*\*\s+\*([\s\S]+?)\*\/\n/
    ) || [, ""])[1]
      .replace(/^ +\*/gm, "")
      .replace(/<this file name>/g, basename(__filename, ".js"));
    console.log(text);
    process.exit(0);
  }

  const doSave = save === "-o" || save === "--output";
  if (doSave) {
    if (!providedSavePath) {
      error(
        `You provided the output flag, but no output file. Please specify the output file`
      );
    }
  }
  const savePath = doSave && resolve(cwd, providedSavePath);

  const projectPath = getProjectPath(arg);

  doSave && console.log(`will write generated config to "${savePath}"`);

  const config = getProjectSlices(projectPath);
  const jsonConfig = JSON.stringify(config, null, 2);
  if (doSave) {
    writeFileSync(savePath, jsonConfig, "utf-8");
  } else {
    console.log(jsonConfig);
  }
} else {
  module.exports = getProjectSlices;
}
