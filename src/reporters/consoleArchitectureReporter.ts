import chalk from 'chalk';
import type { ArchitectureLayer, DirectoryNode } from '../types.js';

function header(title: string): string {
  const line = '─'.repeat(Math.max(title.length + 2, 40));
  return `\n${chalk.bold.cyan(title)}\n${chalk.dim(line)}`;
}

export function reportDiagram(layers: ArchitectureLayer[]): void {
  console.log(header('Project Architecture'));
  console.log('');

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const isLast = i === layers.length - 1;
    const connector = isLast ? '└' : '├';
    const techStr = layer.technologies.length > 0 ? layer.technologies.join(' / ') : 'Unknown';

    console.log(`  ${chalk.bold(layer.name)}`);
    console.log(`  ${connector}─ ${chalk.cyan(techStr)}`);

    if (layer.directories.length > 0) {
      for (let j = 0; j < layer.directories.length; j++) {
        const dirConnector = j === layer.directories.length - 1 ? '└' : '├';
        const prefix = isLast ? '   ' : '│  ';
        console.log(`  ${prefix}${dirConnector}─ ${chalk.dim(layer.directories[j])}`);
      }
    }

    if (!isLast) console.log('  │');
  }

  console.log('');
}

export function reportStructure(tree: DirectoryNode, projectName?: string): void {
  console.log(header('Project Structure'));
  console.log(
    `\n  ${chalk.bold(projectName ?? tree.name + '/')} ${chalk.dim(`(${tree.totalFileCount} files)`)}`,
  );
  printTree(tree.children, '  ');
  console.log('');
}

function printTree(nodes: DirectoryNode[], indent: string): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childIndent = isLast ? '    ' : '│   ';
    const count = chalk.dim(`(${node.totalFileCount} files)`);

    console.log(`${indent}${connector}${chalk.bold(node.name + '/')} ${count}`);

    if (node.children.length > 0) {
      printTree(node.children, indent + childIndent);
    }
  }
}
