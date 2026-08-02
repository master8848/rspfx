import { useState, type JSX } from 'react';
import { Rocket, User } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import './globals.css';

export interface IHelloProps {
  description: string;
  userDisplayName: string;
  userEmail: string | undefined;
  userLoginName: string | undefined;
  siteUrl: string;
  webTitle: string;
  spAvailable: boolean;
}

export default function Hello(props: IHelloProps): JSX.Element {
  const [name, setName] = useState('SharePoint');

  return (
    <div className="bg-background p-6">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="text-primary" aria-hidden="true" />
              <CardTitle>shadcn/ui web part</CardTitle>
            </div>
            <Badge>Tailwind v4</Badge>
          </div>
          <CardDescription>React + shadcn/ui, no Fluent UI.</CardDescription>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <User className="h-4 w-4" aria-hidden="true" />
            <span>
              Signed in as <strong>{props.userDisplayName || 'Guest'}</strong>
              {props.userEmail ? <> ({props.userEmail})</> : null}
            </span>
            <Badge variant={props.spAvailable ? 'default' : 'secondary'}>
              {props.spAvailable ? 'SP ready' : 'SP n/a'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                placeholder="Type a name…"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Button variant="outline" onClick={() => setName('SharePoint')}>
                Reset
              </Button>
            </div>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Hello, <span className="font-medium text-foreground">{name}</span>!
          </p>
        </CardContent>
        <CardFooter className="flex-col items-start gap-1">
          <p className="text-sm text-muted-foreground">{props.description}</p>
          <p className="text-xs text-muted-foreground">
            Site: {props.webTitle} ({props.siteUrl}) · SP user: {props.userLoginName ?? 'n/a'}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
