import JSZip from 'jszip';
import { Project, ProjectAsset } from '../types/project';
import { validateProjectManifest } from './project';

export interface PackageOptions {
  includeMedia: boolean;
  compressionLevel?: number;
}

export interface PackageValidationResult {
  isValid: boolean;
  errors: string[];
  manifest?: Project;
  assetFileCount: number;
  totalUncompressedBytes: number;
}

/**
 * Creates a portable .vnest ZIP package containing the manifest and optional media assets
 */
export async function createVnestPackage(
  project: Project,
  assetBinaryMap: Map<string, Blob | Uint8Array | ArrayBuffer>,
  options: PackageOptions = { includeMedia: true }
): Promise<Blob> {
  const zip = new JSZip();

  // Clone project manifest to adjust paths for package
  const packagedProject: Project = JSON.parse(JSON.stringify(project));
  packagedProject.updatedAt = new Date().toISOString();

  // Package assets if requested
  if (options.includeMedia) {
    const assetsFolder = zip.folder('assets');
    if (!assetsFolder) throw new Error('Failed to create assets folder in zip');

    for (const asset of packagedProject.assets) {
      const binary = assetBinaryMap.get(asset.id);
      if (binary) {
        // Safe sanitized filename
        const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const relativePath = `assets/${asset.id}_${safeName}`;
        assetsFolder.file(`${asset.id}_${safeName}`, binary);

        asset.relativePath = relativePath;
        asset.isBundled = true;
      } else {
        asset.isBundled = false;
      }
    }
  } else {
    for (const asset of packagedProject.assets) {
      asset.isBundled = false;
    }
  }

  // Add manifest.json to root
  zip.file('manifest.json', JSON.stringify(packagedProject, null, 2));

  // Add metadata file
  zip.file('vnest_meta.json', JSON.stringify({
    format: 'vnest-archive',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    totalAssets: packagedProject.assets.length,
    bundledAssets: packagedProject.assets.filter((a) => a.isBundled).length,
  }, null, 2));

  // Generate zip blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: options.compressionLevel || 6 },
  });

  return zipBlob;
}

/**
 * Inspects and validates a .vnest archive before full extraction
 * Enforces strict security constraints: no path traversal, reasonable file limits
 */
export async function inspectAndValidateVnestPackage(
  zipData: Blob | ArrayBuffer | Uint8Array
): Promise<PackageValidationResult> {
  const errors: string[] = [];
  let manifest: Project | undefined;
  let assetFileCount = 0;
  let totalUncompressedBytes = 0;

  try {
    const zip = await JSZip.loadAsync(zipData);

    // Security check: Validate every file path in zip
    const MAX_UNCOMPRESSED_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB safety quota
    const MAX_ENTRY_COUNT = 1000;

    const entries = Object.keys(zip.files);
    if (entries.length > MAX_ENTRY_COUNT) {
      return { isValid: false, errors: ['Archive exceeds safe entry count limit'], assetFileCount: 0, totalUncompressedBytes: 0 };
    }

    for (const entryPath of entries) {
      // Reject directory traversal or absolute paths
      if (
        entryPath.includes('..') ||
        entryPath.startsWith('/') ||
        entryPath.startsWith('\\') ||
        /^[a-zA-Z]:/.test(entryPath)
      ) {
        errors.push(`Potentially malicious or invalid path in archive: ${entryPath}`);
        break;
      }

      const file = zip.files[entryPath];
      if (!file.dir) {
        // Approximate size check if available
        if (file.name.startsWith('assets/')) {
          assetFileCount++;
        }
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors, assetFileCount, totalUncompressedBytes };
    }

    // Check for manifest.json
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return { isValid: false, errors: ['Archive is missing manifest.json'], assetFileCount, totalUncompressedBytes };
    }

    const manifestText = await manifestFile.async('text');
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(manifestText);
    } catch {
      return { isValid: false, errors: ['manifest.json is not valid JSON'], assetFileCount, totalUncompressedBytes };
    }

    const valResult = validateProjectManifest(parsedJson);
    if (!valResult.isValid) {
      return { isValid: false, errors: valResult.errors, assetFileCount, totalUncompressedBytes };
    }

    manifest = valResult.project;

    return {
      isValid: true,
      errors: [],
      manifest,
      assetFileCount,
      totalUncompressedBytes,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      errors: [`Corrupted or invalid zip archive: ${msg}`],
      assetFileCount: 0,
      totalUncompressedBytes: 0,
    };
  }
}

/**
 * Extracts and restores a .vnest package into memory
 */
export async function extractVnestPackage(
  zipData: Blob | ArrayBuffer | Uint8Array
): Promise<{
  project: Project;
  extractedAssets: Map<string, { blob: Blob; url: string }>;
  missingAssets: ProjectAsset[];
}> {
  const validation = await inspectAndValidateVnestPackage(zipData);
  if (!validation.isValid || !validation.manifest) {
    throw new Error(`Cannot open .vnest project: ${validation.errors.join(', ')}`);
  }

  const project = validation.manifest;
  const zip = await JSZip.loadAsync(zipData);
  const extractedAssets = new Map<string, { blob: Blob; url: string }>();
  const missingAssets: ProjectAsset[] = [];

  for (const asset of project.assets) {
    let matchedFile: JSZip.JSZipObject | null = null;

    // First try explicit relativePath
    if (asset.relativePath && zip.file(asset.relativePath)) {
      matchedFile = zip.file(asset.relativePath);
    } else {
      // Search in assets/ for asset.id
      const safePrefix = `assets/${asset.id}_`;
      for (const entryPath of Object.keys(zip.files)) {
        if (entryPath.startsWith(safePrefix) || entryPath === `assets/${asset.id}`) {
          matchedFile = zip.file(entryPath);
          break;
        }
      }
    }

    if (matchedFile) {
      let mimeType = 'application/octet-stream';
      if (asset.type === 'video') {
        mimeType = 'video/mp4';
      } else if (asset.type === 'audio') {
        const lowerName = (asset.name || matchedFile.name).toLowerCase();
        if (lowerName.endsWith('.wav')) mimeType = 'audio/wav';
        else if (lowerName.endsWith('.webm') || lowerName.endsWith('.weba')) mimeType = 'audio/webm';
        else mimeType = 'audio/mpeg';
      } else if (asset.type === 'image') {
        mimeType = 'image/png';
      }

      const arrayBuffer = await matchedFile.async('arraybuffer');
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);

      extractedAssets.set(asset.id, { blob, url });
      asset.isBundled = true;
      asset.isMissing = false;
      asset.blobUrl = url;
    } else {
      asset.isBundled = false;
      asset.isMissing = true;
      missingAssets.push(asset);
    }
  }

  return {
    project,
    extractedAssets,
    missingAssets,
  };
}
