import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const replace = (path, before, after) => {
  const source = readFileSync(path, 'utf8');
  assert(source.includes(before), `Missing integration anchor in ${path}`);
  writeFileSync(path, source.replace(before, after));
};

const applyPath = 'scripts/apply-restore-capped.mjs';
replace(applyPath,
  `replaceOnce(sidebar,\n  '  FileText,\\n',\n  '  FileText,\\n  LayoutDashboard,\\n  Target,\\n  TrendingUp,\\n');`,
  `replaceOnce(sidebar,\n  '  FileText,\\n  Megaphone,\\n',\n  '  FileText,\\n  LayoutDashboard,\\n  Target,\\n  TrendingUp,\\n  Megaphone,\\n');`);

await import('./apply-restore-capped.mjs');

const servicePath = 'src/services/centralBusinessService.ts';
replace(servicePath, "  'pertalife_approver_delegations',\n", '');

const testPath = 'scripts/test-restored-business.mjs';
replace(testPath, 'all eleven restored collections', 'all ten restored collections');
replace(testPath, 'assert.equal(restored.length, 11);', 'assert.equal(restored.length, 10);');
replace(testPath, 'assert.equal(new Set([...lite, ...restored]).size, 19);', 'assert.equal(new Set([...lite, ...restored]).size, 18);');
replace(testPath, ",'pertalife_approver_delegations'", '');
replace(testPath,
  `      assert(ts.isArrayLiteralExpression(node.initializer));\n      value = node.initializer.elements.map(item => {`,
  `      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;\n      assert(ts.isArrayLiteralExpression(init));\n      value = init.elements.map(item => {`);

// The original auth effect has a stable lifecycle. Memoize the new loader
// and its dependent profile loader rather than suppressing exhaustive-deps.
const authPath = 'src/contexts/AuthContext.tsx';
replace(authPath, '  createContext,\n', '  createContext,\n  useCallback,\n');
replace(authPath,
  '    const loadRestoredBusiness = async (authProfile: AuthProfile) => {',
  '    const loadRestoredBusiness = useCallback(async (authProfile: AuthProfile) => {');
replace(authPath,
  `        setRestoredBusinessError(message);
      }
    };

    const loadProfile =`,
  `        setRestoredBusinessError(message);
      }
    }, []);

    const loadProfile =`);
replace(authPath,
  `    const loadProfile =
      async (`,
  `    const loadProfile =
      useCallback(async (`);
replace(authPath,
  `        setProfile(
          authProfile
        );
      };

    useEffect(`,
  `        setProfile(
          authProfile
        );
      }, [loadRestoredBusiness]);

    useEffect(`);
replace(authPath,
  `      },
      []
    );

    useEffect(`,
  `      },
      [loadProfile]
    );

    useEffect(`);

console.log('Integration prepared; live delegation and existing auth lifecycle remain intact.');
